#!/usr/bin/env node
/**
 * confinement — CANDIDATE (harness/sandbox/), not admitted. See
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

const HERE = dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME || ''
export const REPO = process.env.HARNESS_ROOT ? resolve(process.env.HARNESS_ROOT) : resolve(HERE, '..', '..', '..')
const PROJECTS = resolve(HOME, 'Projects')

const under = (p, root) => { const r = resolve(p); return r === root || r.startsWith(root + sep) }

/** A path is forbidden if it lives inside ~/Projects but OUTSIDE os-rebuild — i.e. a sibling project. */
export function forbidden(p, { cwd } = {}) {
  if (!p) return false
  const abs = p.startsWith('~') ? p.replace(/^~/, HOME) : (p.startsWith('/') ? p : resolve(cwd || REPO, p))
  return under(abs, PROJECTS) && !under(abs, REPO)
}

/** Extract candidate target paths from a tool call. */
export function targets(tool, input = {}, cwd) {
  if (['Write', 'Edit', 'Read', 'NotebookEdit'].includes(tool)) return [input.file_path].filter(Boolean)
  if (['Grep', 'Glob'].includes(tool)) return [input.path].filter(Boolean)
  if (tool === 'Bash') {
    const cmd = String(input.command || '')
    // absolute Projects paths, ~/Projects paths, and relative tokens containing .. (possible escapes)
    const abs = cmd.match(/(?:\/Users\/[^\s'"]*\/Projects\/[^\s'"]+|~\/Projects\/[^\s'"]+)/g) || []
    const rel = (cmd.match(/(?:^|\s)(\.\.\/[^\s'"]+|[^\s'"]*\/\.\.\/[^\s'"]+)/g) || []).map((s) => s.trim())
    return [...abs, ...rel].map((s) => s.replace(/[;:,)'"&|]+$/, '')) // strip trailing shell punctuation
  }
  return []
}

/** Decide on a payload. Returns { block, reason, bad }. */
export function decide(payload = {}) {
  const tool = payload.tool_name || ''
  const input = payload.tool_input || {}
  const cwd = payload.cwd || REPO
  const bad = targets(tool, input, cwd).filter((p) => forbidden(p, { cwd }))
  if (bad.length) {
    return { block: true, bad, reason: `confinement: this session is scoped to ${REPO}. Blocked ${tool} targeting a sibling project:\n` + bad.map((b) => `   • ${b}`).join('\n') }
  }
  return { block: false }
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
