#!/usr/bin/env node
/**
 * classifier — CANDIDATE (harness/sandbox/), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * Reads one signal and assigns { type, intent, confidence, target } — the second hop of
 * the loop (extract → CLASSIFY → route). Rules-based and deterministic today; the contract
 * is identical for an LLM-backed classifier later ("classifier scores, orchestrator routes",
 * docs/architecture/harness-observability.md). Honesty rule: when nothing matches with
 * confidence, target is 'unknown' — it never guesses an agent into existence.
 *
 * Confidence routing (architecture): high → auto-route · medium → route + flag · low → ask.
 */

/** Ordered rules. First match wins. Each: { type, intent, target, confidence, test }. */
export const RULES = [
  { type: 'check',    intent: 'check-drift',  target: 'doctor',       confidence: 'high',   test: (s) => /\b(doctor|drift|check|status|health)\b/i.test(s) },
  { type: 'incident', intent: 'investigate',  target: 'investigator', confidence: 'high',   test: (s) => /\b(incident|failed|failure|error|broke|broken|regress|outage)\b/i.test(s) },
  { type: 'build',    intent: 'build',        target: 'orchestrator', confidence: 'medium', test: (s) => /\b(build|implement|create|add|make|wire|refactor|fix)\b/i.test(s) },
  { type: 'question', intent: 'answer',       target: 'unknown',      confidence: 'low',    test: (s) => /\?\s*$/.test(s) || /^\s*(how|what|why|who|when|where)\b/i.test(s) },
]

/**
 * Classify a signal. Returns { type, intent, confidence, target, matchedRule }.
 * Unmatched → an explicit 'unknown' (low confidence, target 'unknown') — never silent,
 * never a fabricated target.
 */
export function classify(signal = {}) {
  const text = String(signal.summary ?? signal.text ?? '').trim()
  for (let i = 0; i < RULES.length; i++) {
    const r = RULES[i]
    if (r.test(text)) {
      return { type: r.type, intent: r.intent, confidence: r.confidence, target: r.target, matchedRule: i }
    }
  }
  return { type: 'unknown', intent: 'unknown', confidence: 'low', target: 'unknown', matchedRule: -1 }
}

// ── thin CLI ──────────────────────────────────────────────────────────────────
function main() {
  const text = process.argv.slice(2).join(' ')
  process.stdout.write(JSON.stringify(classify({ summary: text }), null, 2) + '\n')
}
if (import.meta.url === `file://${process.argv[1]}`) main()
