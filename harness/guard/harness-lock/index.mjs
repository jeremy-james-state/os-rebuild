#!/usr/bin/env node
/**
 * harness-lock — CANDIDATE (pre-admission; see governance/rules/harness-admission.md), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * A per-component single-writer WRITE-LOCK, enforced as a PreToolUse handler (separate from
 * confinement/). Two agents must not edit the SAME harness component concurrently: git reconciles
 * at merge, but this prevents the collision locally. When a WRITE targets a harness component, the
 * lock is acquired (or refreshed) under the acting session's identity; a WRITE that would collide
 * with a LIVE lock held by a DIFFERENT holder is blocked (exit 2).
 *
 * The lock is a CONTROL, so the fail direction is asymmetric and deliberate:
 *   • fail CLOSED on a real conflict — a live foreign lock DENIES the write (exit 2 + stderr).
 *   • fail OPEN on any guard error — a bad payload, an fs error, or unknown state NEVER wedges the
 *     session (exit 0). Only the explicit live-foreign-lock branch blocks.
 *
 * Holder identity is stable across a session and its subagents so a single actor never self-blocks:
 * payload.session_id → env HARNESS_LOCK_HOLDER → the git branch. A lock is LIVE iff its `ts` is
 * within TTL AND its pid is alive. A stale (old ts) or dead-pid lock is treated as free and
 * re-acquired.
 *
 * Hook contract: PreToolUse. Blocks with exit 2 + stderr; otherwise exit 0. Zero-dependency ESM.
 */
import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
} from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = process.env.HARNESS_ROOT ? resolve(process.env.HARNESS_ROOT) : resolve(HERE, '..', '..', '..')

/** A lock is LIVE for at most this long since its `ts` (fail-open beyond it). */
export const TTL_MS = 2 * 60 * 60 * 1000 // 2h

const under = (p, root) => { const r = resolve(p); return r === root || r.startsWith(root + sep) }

/** The lock directory (gitignored runtime state) under the repo. */
export function lockDir(root = REPO) { return join(root, 'state', 'harness-locks') }
/** The lock file for a component. */
export function lockPath(component, root = REPO) { return join(lockDir(root), `${component}.lock`) }

/**
 * Resolve the harness COMPONENT owning an absolute-or-repo-relative path, or null if none.
 * A component is the `harness/<type-or-sandbox>/<component>/` segment (sandbox nests one deeper).
 */
export function componentOf(p, { cwd = REPO, root = REPO } = {}) {
  if (!p) return null
  const abs = p.startsWith('/') ? resolve(p) : resolve(cwd || root, p)
  // Re-keyed at os-reshape P1 to the new geometry: kernel parts under
  // harness/<loop|guard>/<component>/, apps under apps/<component>/ with
  // candidates one level deeper in apps/_drafts/<component>/.
  if (under(abs, join(root, 'harness'))) {
    const rest = abs.slice(join(root, 'harness').length).split(sep).filter(Boolean)
    // Direct children of harness/ ARE the spine (manifest.json + schema +
    // generated twins + render.mjs) — the most contended files in the
    // one-spine design. They lock as one reserved pseudo-component (no
    // census id collides with it) instead of falling through to null/allow.
    if (rest.length === 1) return 'harness-spine'
    return rest[1] || null // loop/<component>, guard/<component>, lib/<component>
  }
  if (under(abs, join(root, 'apps'))) {
    const rest = abs.slice(join(root, 'apps').length).split(sep).filter(Boolean)
    if (rest[0] === '_drafts') return rest[1] || null
    return rest[0] || null
  }
  return null
}

/**
 * Best-effort: extract candidate WRITE target paths from a tool call. Returns [] when this is not
 * a write (→ allow). Reads are never writes. Bash is best-effort: only obvious file-producing
 * redirections/commands into a harness/ path count; when unsure we return [] (treat as non-write).
 */
export function writeTargets(tool, input = {}) {
  if (['Write', 'Edit', 'NotebookEdit'].includes(tool)) return [input.file_path].filter(Boolean)
  if (typeof tool === 'string' && tool.startsWith('mcp__')) {
    // an mcp tool with any string arg that looks like a harness/ or apps/ path
    const vals = Object.values(input || {}).filter((v) => typeof v === 'string')
    return vals.filter((v) => ['harness/', 'harness' + sep, 'apps/', 'apps' + sep].some((z) => v.includes(z)))
  }
  if (tool === 'Bash') {
    const cmd = String(input.command || '')
    // Only flag commands that plausibly WRITE under harness/ or apps/: a redirection, or a known
    // mutating command with such an argument. Reads (cat/grep/node --test) are NOT writes → [].
    const out = []
    // `> harness/...`, `>> apps/...`
    for (const m of cmd.matchAll(/>>?\s*("?)((?:\.\/)?(?:harness|apps)\/[^\s'"|;&)]+)\1/g)) out.push(m[2])
    // mutating verbs with a harness/ or apps/ path arg (tee/cp/mv/sed -i/touch/rm/mkdir)
    if (/\b(tee|cp|mv|touch|rm|mkdir|sed\s+-i)\b/.test(cmd)) {
      for (const m of cmd.matchAll(/(?:\s|^)((?:\.\/)?(?:harness|apps)\/[^\s'"|;&)]+)/g)) out.push(m[1])
    }
    return out
  }
  return []
}

/** Read a lock file; any parse/fs error → null (treated as no lock → allow/acquire). */
export function readLock(component, root = REPO) {
  const p = lockPath(component, root)
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}

/** Is a pid alive? A signal-0 probe; EPERM still means alive. Unknown → false (fail-open: treat as dead → free). */
export function defaultPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false
  try { process.kill(pid, 0); return true } catch (e) { return e && e.code === 'EPERM' }
}

/**
 * A lock is LIVE iff its `ts` is within TTL of `now` AND its pid is alive. Anything else (no lock,
 * bad ts, dead pid, stale ts) → not live → the component is free.
 */
export function isLive(lock, { now = Date.now(), pidAlive = defaultPidAlive } = {}) {
  if (!lock || !lock.ts) return false
  const t = Date.parse(lock.ts)
  if (Number.isNaN(t)) return false
  if (now - t > TTL_MS) return false
  return pidAlive(lock.pid)
}

/** The acting holder id: payload.session_id → env HARNESS_LOCK_HOLDER → the git branch → 'unknown'. */
export function holderId(payload = {}, root = REPO) {
  if (payload.session_id) return String(payload.session_id)
  if (process.env.HARNESS_LOCK_HOLDER) return process.env.HARNESS_LOCK_HOLDER
  try {
    const b = execFileSync('git', ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim()
    if (b) return `branch:${b}`
  } catch { /* fail-open */ }
  return 'unknown'
}

/** Write (acquire/refresh) the lock file for a component under `holder`. */
export function acquire(component, holder, { root = REPO, now = Date.now(), payload = {} } = {}) {
  const lock = {
    holder,
    session: payload.session_id ?? null,
    pid: process.pid,
    branch: (() => { try { return execFileSync('git', ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim() } catch { return null } })(),
    worktree: payload.cwd || root,
    ts: new Date(now).toISOString(),
  }
  mkdirSync(lockDir(root), { recursive: true })
  writeFileSync(lockPath(component, root), JSON.stringify(lock))
  return lock
}

/** Release (remove) a component's lock. Best-effort; a missing file is fine. */
export function release(component, root = REPO) {
  const p = lockPath(component, root)
  try { if (existsSync(p)) writeFileSync(p, '') } catch { /* best-effort */ }
  // Note: we blank rather than unlink so the reconciler's orphan-clear owns removal.
}

/**
 * Decide on a PreToolUse payload. Returns { block, reason, component, holder }.
 * Fail-OPEN by construction: any not-a-write, unresolvable component, or absent/stale/dead lock
 * → { block:false } (acquiring where applicable). Fail-CLOSED only when a LIVE lock is held by a
 * DIFFERENT holder.
 */
export function decide(payload = {}, deps = {}) {
  const root = deps.root || REPO
  const now = deps.now || Date.now()
  const pidAlive = deps.pidAlive || defaultPidAlive
  const tool = payload.tool_name || ''
  const input = payload.tool_input || {}
  const cwd = payload.cwd || root

  const targets = writeTargets(tool, input)
  if (!targets.length) return { block: false } // not a write → allow

  const components = [...new Set(targets.map((t) => componentOf(t, { cwd, root })).filter(Boolean))]
  if (!components.length) return { block: false } // no harness component resolved → allow (fail-open)

  const me = deps.holder || holderId(payload, root)
  for (const component of components) {
    const lock = readLock(component, root)
    if (lock && lock.holder && lock.holder !== me && isLive(lock, { now, pidAlive })) {
      return {
        block: true,
        component,
        holder: lock.holder,
        reason: `harness-lock: component '${component}' is locked by another writer (holder=${lock.holder}, pid=${lock.pid}). Acquire it there or wait — a single component has one live writer.`,
      }
    }
  }
  // No live foreign lock on any target component → acquire/refresh ours and allow.
  for (const component of components) {
    try { acquire(component, me, { root, now, payload }) } catch { /* fail-open: never wedge on an fs error */ }
  }
  return { block: false, component: components[0], holder: me }
}

// ─────────────────────────────────────────────────────────────────────────────
// BRANCH-DISCIPLINE GUARD (dormant) — decideBranchDiscipline
//
// Part of the merge/concurrency failsafe (group D). EXPORTED and TESTED but NOT
// wired into main(): the live hook still runs only decide() above. A human wires
// this at the merge-failsafe flip (governance/candidates.md). Same dormant-addition
// precedent as confinement's decideStrict — the live contract (and version) is
// unchanged, so a bug here cannot brick the running session.
//
// Rule: an architecture write (a WRITE tool targeting harness/ or governance/) must
// happen on a work/<id> branch, never directly on main. So:
//   • WRITE targeting harness/ or governance/  AND  current branch is `main`  → BLOCK.
//   • anything else                                                          → allow.
//
// Control semantics (asymmetric, deliberate):
//   • fail-CLOSED on the explicit "on main + architecture write" condition (BLOCK).
//   • fail-OPEN on any guard error — can't read the branch, bad payload, etc. → allow.
//     `branch` defaults to reading the current git branch, failing open to '' when
//     unavailable; it is injectable so tests need no git.
// ─────────────────────────────────────────────────────────────────────────────

/** Read the current git branch; fail-open to '' when git/branch is unavailable. */
export function currentBranch(root = REPO) {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch { return '' } // fail-open: unreadable branch → allow (caller treats '' as not-main)
}

/**
 * Does a tool call WRITE under an architecture-critical dir (harness/ or governance/)?
 * Reuses writeTargets() (so reads/non-writes return no targets → false). writeTargets is
 * harness-scoped, so governance/ paths are detected here from the same tool input, mirroring
 * writeTargets' own extraction shape (direct file_path; mcp string args; Bash redirect/mutate).
 */
export function isArchitectureWrite(tool, input = {}) {
  const hitsArch = (p) => {
    if (typeof p !== 'string') return false
    const s = p.replace(/^\.\//, '')
    return /^(harness|apps|governance)[\\/]/.test(s) || s.includes('/harness/') || s.includes('/apps/') || s.includes('/governance/')
  }
  // Any harness/ target from the shared extractor already means an architecture write.
  if (writeTargets(tool, input).some(hitsArch)) return true
  // governance/ targets — same extraction shape as writeTargets, widened to governance/.
  if (['Write', 'Edit', 'NotebookEdit'].includes(tool)) return hitsArch(input.file_path || '')
  if (typeof tool === 'string' && tool.startsWith('mcp__')) {
    return Object.values(input || {}).some((v) => typeof v === 'string' && hitsArch(v))
  }
  if (tool === 'Bash') {
    const cmd = String(input.command || '')
    if (/>>?\s*"?(?:\.\/)?governance\//.test(cmd)) return true
    if (/\b(tee|cp|mv|touch|rm|mkdir|sed\s+-i)\b/.test(cmd) && /(?:\s|^)(?:\.\/)?governance\//.test(cmd)) return true
  }
  return false
}

/**
 * Decide branch discipline on a PreToolUse payload. Returns { block, reason }.
 * Fail-CLOSED only on: an architecture write while on `main`. Fail-OPEN otherwise
 * (non-write, non-architecture target, off-main branch, unreadable branch, any error).
 */
export function decideBranchDiscipline(payload = {}, { root = REPO, branch } = {}) {
  try {
    const b = branch === undefined ? currentBranch(root) : String(branch || '')
    if (b !== 'main') return { block: false } // off main (or unknown) → allow (fail-open)
    const tool = payload.tool_name || ''
    const input = payload.tool_input || {}
    if (!isArchitectureWrite(tool, input)) return { block: false } // not an architecture write → allow
    return {
      block: true,
      reason: `harness-lock(branch-discipline): architecture changes to harness/, apps/ or governance/ must be made on a work/<id> branch, not directly on 'main'. Create a work branch (e.g. \`git switch -c work/<id>\`) and retry there.`,
    }
  } catch { return { block: false } } // any guard error → allow (fail-open)
}

function main() {
  let buf = ''
  const done = (code) => process.exit(code)
  try {
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (d) => { buf += d })
    process.stdin.on('end', () => {
      let payload = {}
      try { payload = JSON.parse(buf || '{}') } catch { return done(0) } // can't parse → fail open
      let r
      try { r = decide(payload) } catch { return done(0) } // any guard error → fail open
      if (r && r.block) { process.stderr.write('⛔ ' + r.reason + '\n'); return done(2) }
      done(0)
    })
    process.stdin.on('error', () => done(0))
  } catch { done(0) }
  setTimeout(() => done(0), 400) // no stdin → fail open
}
if (import.meta.url === `file://${process.argv[1]}`) main()
