#!/usr/bin/env node
/**
 * estimator — CANDIDATE (harness/sandbox/), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * Scores a work item so the orchestrator can prioritise it: "estimator scores, scheduler
 * dispatches" (docs/architecture/harness-architecture.md, VOCABULARY.md). A runner the
 * orchestrator CONSULTS — it never dispatches. Deterministic rubric today; swappable to an
 * LLM scorer behind the same contract.
 *
 * Factors (each 0..1): value (worth doing), conf (classifier confidence), effort (cost),
 * readiness (is the target a real, reachable component?). Priority rewards value·conf and
 * readiness, penalises effort.
 */
const VALUE     = { incident: 0.9, build: 0.7, check: 0.5, question: 0.3, unknown: 0.1 }
const EFFORT    = { build: 0.8, incident: 0.5, question: 0.2, unknown: 0.2, check: 0.1 }
const CONFIDENCE = { high: 1.0, medium: 0.6, low: 0.3 }

const clamp01 = (x) => Math.max(0, Math.min(1, x))

/**
 * Estimate a classified work item. Returns { score (0..100), band, factors }.
 * `readiness` is 1 only when the target is a real, named component (not 'unknown').
 */
export function estimate(item = {}) {
  const type = item.type ?? 'unknown'
  const value = VALUE[type] ?? 0.1
  const conf = CONFIDENCE[item.confidence] ?? 0.3
  const effort = EFFORT[type] ?? 0.5
  const readiness = item.target && item.target !== 'unknown' ? 1 : 0
  const raw = clamp01(0.45 * value * conf + 0.4 * readiness - 0.15 * effort)
  const score = Math.round(raw * 100)
  const band = score >= 66 ? 'high' : score >= 33 ? 'medium' : 'low'
  return { score, band, factors: { value, conf, effort, readiness } }
}

/** Score and order many items, highest priority first (stable). For backlog prioritisation. */
export function rank(items = []) {
  const list = Array.isArray(items) ? items : []   // a missing/null backlog yields [], never throws
  return list
    .map((item, i) => ({ item, i, ...estimate(item) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
}

// ── thin CLI ──────────────────────────────────────────────────────────────────
function main() {
  const [type, confidence, target] = process.argv.slice(2)
  process.stdout.write(JSON.stringify(estimate({ type, confidence, target }), null, 2) + '\n')
}
if (import.meta.url === `file://${process.argv[1]}`) main()
