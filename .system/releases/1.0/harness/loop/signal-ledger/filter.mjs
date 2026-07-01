#!/usr/bin/env node
/**
 * filter — CANDIDATE (pre-admission; see governance/rules/harness-admission.md). Decides whether a hook payload is a REAL input worth
 * capturing as a signal. Now that capture auto-commits + auto-syncs, system-injected turns
 * (task notifications, system reminders, Stop-hook feedback, webhook/untrusted envelopes) must
 * NOT become signals — they'd pollute the truth log and burn CI. Pure + testable.
 *
 * Scope today: UserPromptSubmit prompts. When per-tool capture (PostToolUse) lands, extend this
 * to classify those events too. The default is conservative: empty/system turns are dropped.
 */
const DROP_PREFIXES = [
  '<task-notification',
  '<system-reminder',
  '<github-webhook-activity',
  '<untrusted',
  'Stop hook feedback:',
]

/** True iff this payload is a genuine user input (not a system-injected turn). */
export function isRealInput(payload = {}) {
  const prompt = (typeof payload.prompt === 'string' ? payload.prompt : '').trim()
  if (!prompt) return false
  return !DROP_PREFIXES.some((prefix) => prompt.startsWith(prefix))
}
