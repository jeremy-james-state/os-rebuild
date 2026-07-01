#!/usr/bin/env node
/**
 * orchestrator — CANDIDATE (harness/sandbox/), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * The loop driver (the scheduler). It runs one signal through every hop and records a
 * TERMINAL outcome — nothing is dropped:
 *
 *   extract → classify → estimate → DISPATCH → outcome (completed | unknown | failed)
 *
 * Separation of powers (architecture): the classifier scores the signal, the estimator
 * scores the work, and the orchestrator ROUTES. It dispatches only to a REAL handler in
 * its table; an unrecognised target becomes an explicit 'unknown' — it can never fake a
 * call to an agent that isn't there (the no-ghost-agent guarantee, runtime side).
 *
 * Every hop opens a span on one trace and appends a four-tuple-stamped row via loop-store,
 * so the run is followable end-to-end and the data layer fills as it goes. The returned
 * `feedback` lines are what the session-feedback hook prints into the chat.
 */
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { newTrace, span, fourTuple, stamp, activeRelease, componentVersion } from '../tracer/index.mjs'
import { append } from '../loop-store/index.mjs'
import { classify } from '../classifier/index.mjs'
import { estimate } from '../estimator/index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..', '..', '..')

/** Dispatch table: target → live handler. ONLY real handlers live here. */
export const HANDLERS = {
  // The doctor is a real, wired component — run the drift-check for real. spawnSync (not
  // execFileSync) with a hard timeout: a non-zero exit (doctor is fail-closed on drift) still
  // yields parseable stdout, so the dispatch is 'completed' and the drift detail rides in the
  // result — the visible outcome no longer flips completed↔failed on repo state. A hang hits
  // the timeout → r.error → 'failed', never blocking the turn.
  doctor: () => {
    const r = spawnSync(process.execPath, [join(REPO_ROOT, 'governance/enforcement/doctor.mjs'), '--json'],
      { encoding: 'utf8', cwd: REPO_ROOT, timeout: 5000 })
    if (r.error) throw r.error
    let findings = []
    try { ({ findings } = JSON.parse(r.stdout || '{"findings":[]}')) } catch { findings = [] }
    const errors = findings.filter((f) => f.severity === 'ERROR').length
    return { ok: errors === 0, errors, warnings: findings.filter((f) => f.severity === 'WARN').length }
  },
}

/**
 * Run one signal through the loop. Returns
 *   { trace, signal, classification, estimate, outcome, feedback, oneLine }.
 * `opts`: { handlers, dir (record dir), idGen, now, session, run, call }. idGen/now are
 * injectable so the whole run is deterministic in tests.
 */
export function runLoop(input = {}, opts = {}) {
  const handlers = opts.handlers || HANDLERS
  const dir = opts.dir
  const now = opts.now || (() => new Date().toISOString())
  const idGen = opts.idGen || (() => randomUUID())
  const w = (stream, row) => append(stream, row, dir ? { dir, now } : { now })

  const summary = String(input.summary ?? input.prompt ?? input.text ?? '').trim()
  const feedback = []

  // Version-stamp (OBSERVABILITY → fail-OPEN): read the active harness release up front so it
  // rides on every run row. A read that fails degrades to `null` — it must never alter the outcome.
  let hv = null
  try { hv = activeRelease(REPO_ROOT) } catch { hv = null }

  // hop 0: open the trace + four-tuple
  const trace = newTrace({ id: idGen(), now })
  const tuple = fourTuple({ session: opts.session, run: opts.run ?? trace.traceId, call: opts.call })

  // hop 1: extract
  const sExtract = span(trace, 'extract', { id: idGen(), now })
  const sig = w('signals', stamp({ kind: 'signal', phase: 'received', summary, source: input.source || 'cli' }, sExtract, tuple))
  if (!sig.ok) {
    // the signal write was DROPPED — do NOT pretend it was captured. Record an explicit
    // terminal failed run (with the stable id) so nothing fails silently.
    feedback.push(`signal DROPPED (#${sig.n}) — ${sig.reason || 'write failed'}`)
    const sRouteD = span(sExtract, 'route', { id: idGen(), now })
    const outcomeD = { status: 'failed', target: null, error: `signal write dropped: ${sig.reason || 'unknown'}` }
    const runD = w('runs', stamp({ kind: 'run', signal: sig.id, target: null, status: 'failed', summary, outcome: outcomeD, harnessVersion: hv }, sRouteD, tuple))
    feedback.push('outcome: failed — signal not durably captured')
    return { trace, signal: sig, classification: null, estimate: null, outcome: outcomeD, run: runD, feedback, oneLine: `⟶ ${feedback.join('  ·  ')}` }
  }
  feedback.push(`signal extracted (#${sig.n})`)

  // hop 2: classify
  const sClassify = span(sExtract, 'classify', { id: idGen(), now })
  const classification = classify({ summary })
  w('classified', stamp({ kind: 'classification', signal: sig.id, summary, ...classification }, sClassify, tuple))
  feedback.push(`classified → ${classification.type} (${classification.confidence}) → ${classification.target}`)

  // hop 3: estimate
  const sEstimate = span(sClassify, 'estimate', { id: idGen(), now })
  const est = estimate(classification)
  w('estimates', stamp({ kind: 'estimate', signal: sig.id, ...est }, sEstimate, tuple))
  feedback.push(`estimated ${est.score} (${est.band})`)

  // hop 4: dispatch → outcome
  const sRoute = span(sEstimate, 'route', { id: idGen(), now })
  const target = classification.target
  const handler = handlers[target]
  let outcome
  if (!handler) {
    outcome = { status: 'unknown', target, reason: `no live handler for '${target}'` }
  } else {
    try { outcome = { status: 'completed', target, result: handler(sig, classification) } }
    catch (e) { outcome = { status: 'failed', target, error: String(e?.message || e) } }
  }
  // fail-open: componentVersion is null when the target isn't a registry id (e.g. 'doctor', 'unknown')
  let cv = null
  try { cv = componentVersion(target, REPO_ROOT) } catch { cv = null }
  const run = w('runs', stamp({ kind: 'run', signal: sig.id, target, status: outcome.status, summary, outcome, harnessVersion: hv, ...(cv ? { componentVersion: cv } : {}) }, sRoute, tuple))
  feedback.push(`routed → ${target}`)
  feedback.push(`outcome: ${outcome.status}${outcome.reason ? ` — ${outcome.reason}` : ''}`)
  // OBSERVABILITY (fail-open): show the active release on the visible trace. Only when known —
  // a null version simply omits the segment, never breaks the line.
  if (hv) feedback.push(`v${hv}`)

  const oneLine = `⟶ ${feedback.join('  ·  ')}`
  return { trace, signal: sig, classification, estimate: est, outcome, run, feedback, oneLine }
}

// ── thin CLI ──────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2)
  const summary = args.filter((a) => a !== '--demo').join(' ') || 'check the harness for drift'
  const r = runLoop({ summary })
  process.stdout.write(r.feedback.map((l, i) => `  ${i + 1}. ${l}`).join('\n') + '\n')
  process.exitCode = r.outcome.status === 'completed' ? 0 : r.outcome.status === 'unknown' ? 3 : 1
}
if (import.meta.url === `file://${process.argv[1]}`) main()
