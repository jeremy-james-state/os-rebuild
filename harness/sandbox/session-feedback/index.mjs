#!/usr/bin/env node
/**
 * session-feedback — CANDIDATE (harness/sandbox/), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * The hook that makes the loop VISIBLE. Wired on UserPromptSubmit: when you type a command,
 * it runs the orchestrator loop on your prompt and prints the trace back into the session —
 *
 *   🔁 OS loop  signal extracted (#7)  ·  classified → check (high) → doctor  ·
 *               estimated 61 (medium)  ·  routed → doctor  ·  outcome: completed
 *
 * so you can watch the signal pass through the nodes. FAIL-OPEN: any error is swallowed and
 * the turn proceeds untouched — the feedback is observability, never a gate.
 *
 * Test/CLI: `printf '{"prompt":"check drift"}' | node index.mjs`  or  `node index.mjs --text "check drift"`.
 */
import { runLoop } from '../orchestrator/index.mjs'
import { project } from '../loop-store/index.mjs'

function readStdin() {
  return new Promise((res) => {
    let data = ''
    if (process.stdin.isTTY) return res('')
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => { data += c })
    process.stdin.on('end', () => res(data))
    process.stdin.on('error', () => res(data))
    setTimeout(() => res(data), 250) // never hang the turn
  })
}

export function extractPrompt(payload = {}) {
  return String(payload.prompt ?? payload.user_prompt ?? payload.summary ?? payload.text ?? '')
}

export function renderLine(result) {
  return `🔁 OS loop  ${result.feedback.join('  ·  ')}`
}

async function main() {
  let prompt = ''
  const argv = process.argv.slice(2)
  const ti = argv.indexOf('--text')
  if (ti >= 0) prompt = argv.slice(ti + 1).join(' ')
  else {
    try { const raw = await readStdin(); prompt = raw.trim() ? extractPrompt(JSON.parse(raw)) : '' }
    catch { prompt = '' }
  }
  if (!prompt.trim()) { process.exit(0) }            // nothing to observe — fail-open

  try {
    const r = runLoop({ summary: prompt, source: 'session' })
    try { project() } catch { /* projection is best-effort; the JSONL truth is already durable */ }
    process.stdout.write(renderLine(r) + '\n')
  } catch (e) {
    process.stdout.write(`🔁 OS loop  (skipped: ${String(e?.message || e).slice(0, 80)})\n`)
  }
  process.exit(0)                                    // never block the turn
}
if (import.meta.url === `file://${process.argv[1]}`) main()
