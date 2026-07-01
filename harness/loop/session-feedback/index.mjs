#!/usr/bin/env node
/**
 * session-feedback — CANDIDATE (pre-admission; see governance/rules/harness-admission.md), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * The UserPromptSubmit hook that lets the harness GOVERN a turn — as far as Claude Code
 * actually allows (verified against the hooks docs; see the honesty split below). Every
 * prompt runs the real loop (classify → estimate → route → EXECUTE the routed handler →
 * record) BEFORE the model sees anything. Then, by mode:
 *
 *   • EXPLICIT COMMAND ("os: drift") that completes on a real handler at high confidence
 *     → returns {"decision":"block", reason:<harness output>}. The model is BYPASSED
 *       entirely; the user sees the harness's deterministic result. ENFORCED governance.
 *   • otherwise (natural language, or a command that failed / was low-confidence)
 *     → returns {hookSpecificOutput:{hookEventName:"UserPromptSubmit", additionalContext:<
 *       the trace + an operating protocol>}}. The model runs; the context STEERS it to act
 *       as the routed component. Honestly soft — the model can ignore it.
 *
 * Honesty split (what the workflow's adversarial pass confirmed):
 *   ENFORCED  — real handler runs; outcome recorded to record/runs.jsonl; on an explicit
 *               command, the model does not run at all.
 *   STEERED   — everything about how the model narrates a non-blocked turn.
 *
 * FAIL-OPEN: any error → exit 0 with no output; the turn proceeds untouched. Never blocks
 * on a failed/timeout check (availability over false authority).
 */
import { runLoop } from '../orchestrator/index.mjs'
import { project } from '../loop-store/index.mjs'

const COMMAND_RE = /^\s*os:\s*(.*)$/is  // the explicit-command sigil (no clash with Claude Code ! or /)

export function parseCommand(prompt) {
  const m = COMMAND_RE.exec(prompt || '')
  return m ? { isCommand: true, summary: m[1].trim() } : { isCommand: false, summary: String(prompt || '').trim() }
}

export function extractPrompt(payload = {}) {
  return String(payload.prompt ?? payload.user_prompt ?? payload.summary ?? payload.text ?? '')
}

export function renderLine(result) {
  return `🔁 OS loop  ${result.feedback.join('  ·  ')}`
}

function handlerDetail(r) {
  const res = (r.outcome && r.outcome.result) || {}
  if (r.classification && r.classification.target === 'doctor' && ('errors' in res || 'warnings' in res)) {
    return `doctor: ${res.errors ?? '?'} errors, ${res.warnings ?? '?'} warnings — ${res.ok ? 'harness not in drift' : 'DRIFT (errors present)'}`
  }
  return r.outcome ? `outcome: ${r.outcome.status}${r.outcome.reason ? ` — ${r.outcome.reason}` : ''}` : ''
}

function renderBlockReason(r) {
  return [renderLine(r), `   ${handlerDetail(r)}`, `[handled by the harness — the model was bypassed for this command]`].join('\n')
}

function renderContext(r, isCommand) {
  const lines = [
    `[HARNESS] Before you saw it, this prompt ran through the signal loop:`,
    `  ${renderLine(r)}`,
  ]
  const detail = handlerDetail(r)
  if (detail) lines.push(`  ${detail}`)
  lines.push(
    ``,
    `OPERATING PROTOCOL — you are a COMPONENT of this harness, not a free agent:`,
    `1. Begin your reply with the 🔁 trace line above, verbatim.`,
    `2. The loop already classified, routed, and ran any real handler. Report that outcome faithfully — do NOT re-run it, do NOT invent a different result.`,
    `3. Address the user's actual request within the routed intent; do not free-associate beyond it.`,
  )
  if (isCommand) lines.push(`4. This was an explicit "os:" command that did not complete deterministically (${r.outcome.status}); handle it and say plainly why it didn't short-circuit.`)
  return lines.join('\n')
}

/**
 * Decide the hook's response for a prompt. Returns { mode, json, result }.
 * `run`/`proj` injectable for tests. Never throws.
 */
export function decideHook(prompt, { run = runLoop, proj = project } = {}) {
  const { isCommand, summary } = parseCommand(prompt)
  if (!summary) return { mode: 'noop', json: null }
  let r
  try { r = run({ summary, source: 'session' }); try { proj() } catch { /* projection best-effort */ } }
  catch (e) { return { mode: 'error', json: null, error: String(e?.message || e) } }

  const c = r.classification || {}
  const completed = r.outcome && r.outcome.status === 'completed'
  const highConf = c.confidence === 'high' && c.target && c.target !== 'unknown'
  // ENFORCED path: block ONLY on an explicit command that really completed at high confidence.
  // Never block on natural language (would eat a real question) or on a failed/timeout check.
  if (isCommand && completed && highConf) {
    return { mode: 'block', json: { decision: 'block', reason: renderBlockReason(r) }, result: r }
  }
  // STEERED path: run stays recorded; inject the trace + operating protocol for the model.
  return {
    mode: 'inject',
    json: { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: renderContext(r, isCommand) } },
    result: r,
  }
}

// ── hook I/O ────────────────────────────────────────────────────────────────────
function readStdin() {
  return new Promise((res) => {
    let data = ''
    if (process.stdin.isTTY) return res('')
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => { data += c })
    process.stdin.on('end', () => res(data))
    process.stdin.on('error', () => res(data))
    setTimeout(() => res(data), 250)
  })
}

async function main() {
  let prompt = ''
  const argv = process.argv.slice(2)
  const ti = argv.indexOf('--text')
  if (ti >= 0) prompt = argv.slice(ti + 1).join(' ')
  else { try { const raw = await readStdin(); prompt = raw.trim() ? extractPrompt(JSON.parse(raw)) : '' } catch { prompt = '' } }

  let decision
  try { decision = decideHook(prompt) } catch { process.exit(0) } // fail-open
  if (decision.json) process.stdout.write(JSON.stringify(decision.json) + '\n')
  process.exit(0)
}
if (import.meta.url === `file://${process.argv[1]}`) main()
