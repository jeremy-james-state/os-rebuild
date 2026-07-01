#!/usr/bin/env node
/**
 * statusline — CANDIDATE (harness/sandbox/), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * Renders the latest signal-loop trace into the Claude Code STATUS BAR — the one surface
 * that is reliably VISIBLE to the user every turn (UserPromptSubmit hook stdout is only
 * added to the model's context, never shown to the user). Paired with the session-feedback
 * hook: the hook runs the loop and records it; this reads the newest run and displays it.
 *
 *   🔁 "check the harness for drift" · check(high) · ~61 → doctor ⇒ completed
 *
 * Claude Code pipes session JSON on stdin; we ignore it and read the data layer. Fast,
 * fail-open: on any error it prints a bare marker rather than breaking the status bar.
 * Wire in .claude/settings.json:  "statusLine": { "type":"command", "command":"node …/statusline.mjs" }
 */
import { read } from '../loop-store/index.mjs'

export function renderStatus(dir) {
  const runs = read('runs', dir).records
  if (!runs.length) return '🔁 OS loop — idle · type a command'
  const r = runs[runs.length - 1]
  const pick = (stream) => read(stream, dir).records.filter((x) => x.traceId && x.traceId === r.traceId).pop() || {}
  const cls = pick('classified'), est = pick('estimates'), sig = pick('signals')
  const summary = String(sig.summary ?? r.summary ?? '').slice(0, 40)
  const parts = [`🔁 "${summary}"`]
  if (cls.type) parts.push(`· ${cls.type}(${cls.confidence})`)
  if (typeof est.score === 'number') parts.push(`· ~${est.score}`)
  parts.push(`→ ${r.target ?? cls.target ?? '?'}`)
  parts.push(`⇒ ${r.status}`)
  return parts.join(' ')
}

function main() {
  let done = false
  const emit = () => { if (done) return; done = true; try { process.stdout.write(renderStatus() + '\n') } catch { process.stdout.write('🔁 OS loop\n') } process.exit(0) }
  try { process.stdin.setEncoding('utf8'); process.stdin.on('data', () => {}); process.stdin.on('end', emit); process.stdin.on('error', emit) } catch { /* no stdin */ }
  setTimeout(emit, 150) // don't wait on stdin — the status bar must stay snappy
}
if (import.meta.url === `file://${process.argv[1]}`) main()
