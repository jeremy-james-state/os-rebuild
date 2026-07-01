#!/usr/bin/env node
/**
 * confinement — CANDIDATE (pre-admission; see governance/rules/harness-admission.md), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * A PreToolUse fence that keeps a session scoped to os-rebuild. Modeled on the harness Core's
 * write-fence (jeremy-james-state/harness): the session may operate on this repo and on system
 * paths (node, git, tmp), but is BLOCKED from reading, writing, or `cd`-ing into a SIBLING
 * project under ~/Projects (e.g. /Projects/harness, /Projects/OS) — the exact "wandered into
 * the Core" case. It inspects the tool call, resolves candidate target paths, and exits 2
 * (blocking) with a reason if any resolve to a sibling project.
 *
 * This is the interpreter-level PREVENTIVE tier. The hard guarantee (reads too, bypass-proof)
 * is a kernel sandbox — the Core's `claude-safe` / harness.sb — which this mirrors in intent.
 *
 * Hook contract: PreToolUse. Blocks with exit 2 + stderr; otherwise exit 0 (fail-open on any
 * error, so it never wedges a session). Zero-dependency.
 */
import { resolve, sep } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME || ''
export const REPO = process.env.HARNESS_ROOT ? resolve(process.env.HARNESS_ROOT) : resolve(HERE, '..', '..', '..')
const PROJECTS = resolve(HOME, 'Projects')

const under = (p, root) => { const r = resolve(p); return r === root || r.startsWith(root + sep) }

/**
 * A path is forbidden if it lives inside <home>/Projects but OUTSIDE os-rebuild — i.e. a
 * sibling project. `root`/`home` are injectable so a test can pin them (e.g. home=/tmp/h,
 * root=<home>/Projects/os-rebuild) and get a deterministic verdict on any OS/checkout —
 * the ambient HOME and checkout location no longer leak in. Defaults preserve LIVE behavior:
 * root=REPO, home=HOME, projects=resolve(home,'Projects').
 */
export function forbidden(p, { cwd, root = REPO, home = HOME, projects } = {}) {
  if (!p) return false
  const proj = projects || resolve(home, 'Projects')
  const abs = p.startsWith('~') ? p.replace(/^~/, home) : (p.startsWith('/') ? p : resolve(cwd || root, p))
  return under(abs, proj) && !under(abs, root)
}

/**
 * Extract candidate target paths from a tool call. The Bash absolute-path matcher keys off
 * `<home>/Projects/…`, so `home` is injectable to keep it hermetic (defaults to HOME → live
 * behavior). Relative `../` tokens and `~/Projects/…` tokens are matched independently of home.
 */
export function targets(tool, input = {}, cwd, { home = HOME } = {}) {
  if (['Write', 'Edit', 'Read', 'NotebookEdit'].includes(tool)) return [input.file_path].filter(Boolean)
  if (['Grep', 'Glob'].includes(tool)) return [input.path].filter(Boolean)
  if (tool === 'Bash') {
    const cmd = String(input.command || '')
    // absolute <home>/Projects paths, ~/Projects paths, and relative tokens containing .. (possible escapes)
    const homeProj = `${home}/Projects/`
    const abs = []
    const absRe = /(?:\/[^\s'"]*\/Projects\/[^\s'"]+|~\/Projects\/[^\s'"]+)/g
    let m
    while ((m = absRe.exec(cmd))) {
      const tok = m[0]
      if (tok.startsWith('~/Projects/') || tok.startsWith(homeProj)) abs.push(tok)
    }
    const rel = (cmd.match(/(?:^|\s)(\.\.\/[^\s'"]+|[^\s'"]*\/\.\.\/[^\s'"]+)/g) || []).map((s) => s.trim())
    return [...abs, ...rel].map((s) => s.replace(/[;:,)'"&|]+$/, '')) // strip trailing shell punctuation
  }
  return []
}

/**
 * Decide on a payload. Returns { block, reason, bad }. `{ root, home }` are injectable so a
 * test is hermetic (does not depend on the ambient HOME / checkout location); defaults
 * (root=REPO, home=HOME) preserve the LIVE behavior byte-for-byte.
 */
export function decide(payload = {}, { root = REPO, home = HOME } = {}) {
  const tool = payload.tool_name || ''
  const input = payload.tool_input || {}
  const cwd = payload.cwd || root
  const bad = targets(tool, input, cwd, { home }).filter((p) => forbidden(p, { cwd, root, home }))
  if (bad.length) {
    return { block: true, bad, reason: `confinement: this session is scoped to ${root}. Blocked ${tool} targeting a sibling project:\n` + bad.map((b) => `   • ${b}`).join('\n') }
  }
  return { block: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// HARDENED TIER (dormant) — decideStrict
//
// This is the corrected Tier-2 control from the confinement-sandbox design
// (docs/superpowers/specs/2026-07-01-confinement-sandbox-design.md §4). It is
// EXPORTED and TESTED but NOT wired into main(): the live hook still runs the
// fail-OPEN `decide()` above. A human swaps main() to decideStrict at the future
// live wire-in (see governance/candidates.md). Shipping it dormant means a bug in
// this fail-CLOSED logic cannot brick the running session.
//
// Corrections vs. decide():
//   • Allowlist, not blocklist — a WRITE is DENIED unless its real path is under REPO
//     (the opposite shape of `forbidden`, which only blocked ~/Projects siblings).
//   • Fail-CLOSED — for a write tool, any inability to resolve/decide → BLOCK.
//   • Covers all write tools — Write/Edit/NotebookEdit + any mcp__* tool with a
//     path/file argument.
//   • realpath — resolves symlinks before the under-REPO test (defeats a repo-internal
//     symlink that points outside).
// ─────────────────────────────────────────────────────────────────────────────

/** WRITE tools whose file target must be inside REPO. Reads/searches are not writes. */
const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit'])

/** Path-argument keys an mcp__* write tool might carry. */
const MCP_PATH_KEYS = ['file_path', 'path', 'filePath', 'target', 'destination', 'dest', 'output_path', 'outputPath', 'filename', 'file']

/**
 * Resolve a path to its REAL location (following symlinks) so a repo-internal symlink
 * pointing outside REPO cannot masquerade as in-repo. If the path doesn't exist yet
 * (a brand-new file), realpathSync throws → fall back to lexical resolve() of the
 * deepest existing ancestor's realpath joined with the remainder is overkill here;
 * plain resolve() of the (already absolute/expanded) path is sufficient because a
 * not-yet-existing file can't itself be a symlink. Returns null if it cannot be
 * turned into an absolute path at all (→ caller fails closed).
 */
export function realpathOf(p, { cwd } = {}) {
  if (!p || typeof p !== 'string') return null
  const expanded = p.startsWith('~') ? p.replace(/^~/, HOME) : p
  let abs
  try { abs = expanded.startsWith('/') ? expanded : resolve(cwd || REPO, expanded) } catch { return null }
  try { return realpathSync(abs) } catch { return abs } // doesn't exist yet → its own lexical abs path (can't be a symlink)
}

/** True iff `p` (already realpath'd, or realpath-able) lives inside `root`. */
export function underRepo(p, root = REPO, { cwd } = {}) {
  const real = realpathOf(p, { cwd })
  if (!real) return false
  return under(real, root)
}

/** Path targets carried by a WRITE tool call, for the allowlist test. Bash is intentionally absent (see decideStrict). */
export function writeTargets(tool, input = {}) {
  if (WRITE_TOOLS.has(tool)) return [input.file_path].filter((v) => typeof v === 'string' && v.length)
  if (tool.startsWith('mcp__')) {
    const out = []
    for (const k of MCP_PATH_KEYS) { const v = input[k]; if (typeof v === 'string' && v.length) out.push(v) }
    return out
  }
  return []
}

/** Heuristic: does this mcp__* tool look like it writes to the filesystem? */
const MCP_WRITE_HINT = /(write|edit|create|save|append|put|upload|move|copy|rename|mkdir|delete|remove|patch|apply)/i

/** True iff the tool is one whose filesystem target we must confine to REPO. */
export function isWriteTool(tool = '') {
  if (WRITE_TOOLS.has(tool)) return true
  if (tool.startsWith('mcp__')) return MCP_WRITE_HINT.test(tool)
  return false
}

/**
 * HARDENED, FAIL-CLOSED decision (dormant — not wired). Returns { block, reason }.
 *
 *   • Read / non-write tool                         → allow.
 *   • Bash                                          → allow WITH a note. A PreToolUse hook
 *       cannot reliably know what a shell command writes (variables, $HOME, cd-chaining,
 *       process substitution). Rather than pretend to parse it, decideStrict defers Bash
 *       confinement to the Tier-1 kernel sandbox (harness.sb), which constrains Bash and
 *       every other tool identically at the syscall level. This is the design's explicit
 *       choice (spec §4: "Stop parsing Bash for safety … rely on Tier 1").
 *   • Write / Edit / NotebookEdit / mcp__* write    → ALLOW only if every target's REAL
 *       path is under REPO; otherwise BLOCK (allowlist). If a target can't be resolved,
 *       or there are no resolvable targets on an apparent write, or any error occurs →
 *       BLOCK (fail-closed — the control tier over-blocks rather than leak).
 */
export function decideStrict(payload = {}, { root = REPO } = {}) {
  try {
    const tool = payload.tool_name || ''
    const input = payload.tool_input || {}
    const cwd = payload.cwd || root

    if (tool === 'Bash') {
      return { block: false, reason: 'confinement(strict): Bash is not verified at this tier — its filesystem writes are constrained by the Tier-1 kernel sandbox (harness.sb).' }
    }

    if (!isWriteTool(tool)) return { block: false } // reads/searches/other → allow

    const targetsFound = writeTargets(tool, input)
    if (!targetsFound.length) {
      // A write tool with no locatable path argument is ambiguous → fail closed.
      return { block: true, reason: `confinement(strict): ${tool} is a write tool but no target path could be located in its input — blocking (fail-closed).` }
    }

    const bad = []
    for (const t of targetsFound) {
      if (!underRepo(t, root, { cwd })) bad.push(t)
    }
    if (bad.length) {
      return { block: true, reason: `confinement(strict): this session is scoped to ${root}. Blocked ${tool} writing outside the repo:\n` + bad.map((b) => `   • ${b} → ${realpathOf(b, { cwd }) || '(unresolvable)'}`).join('\n') }
    }
    return { block: false }
  } catch (e) {
    // Any exception while deciding a write → block. (Contrast decide(), which fails open.)
    return { block: true, reason: `confinement(strict): error while deciding — blocking (fail-closed): ${e && e.message}` }
  }
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
      const r = decide(payload)
      if (r.block) { process.stderr.write('⛔ ' + r.reason + '\n'); return done(2) }
      done(0)
    })
    process.stdin.on('error', () => done(0))
  } catch { done(0) }
  setTimeout(() => done(0), 400) // no stdin → fail open
}
if (import.meta.url === `file://${process.argv[1]}`) main()
