#!/usr/bin/env node
/**
 * reconciler — CANDIDATE (harness/sandbox/), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * The guarantee that nothing fails silently (docs/architecture/harness-observability.md).
 * The orchestrator should record a terminal outcome for every signal — but if a signal was
 * captured and then nothing ran (a crash, a dropped hop), it sits in LIMBO. The reconciler
 * sweeps the data layer for any signal with no terminal run and RAISES an incident. It is
 * the out-of-process backstop: routing may be best-effort, the reconciler must be reliable.
 *
 * Idempotent: a signal already covered by a run OR already raised as an incident is not
 * re-raised. Reads/writes only via loop-store (sole-writer of record/incidents.jsonl here).
 */
import { randomUUID } from 'node:crypto'
import { read, append } from '../loop-store/index.mjs'
import { newTrace, span, stamp, fourTuple } from '../tracer/index.mjs'

/**
 * Sweep for limbo signals and raise an incident for each new one.
 * Returns { checked, limbo: [signalId], raised: [incidentId] }.
 */
export function sweep(opts = {}) {
  const dir = opts.dir
  const now = opts.now || (() => new Date().toISOString())
  const idGen = opts.idGen || (() => randomUUID())
  const rd = (s) => read(s, dir).records
  const w = (stream, row) => append(stream, row, dir ? { dir, now } : { now })

  const signals = rd('signals')
  const coveredByRun = new Set(rd('runs').map((r) => r.signal).filter(Boolean))
  const alreadyRaised = new Set(rd('incidents').filter((i) => i.signal).map((i) => i.signal))

  const limbo = []
  const raised = []
  for (const sig of signals) {
    if (coveredByRun.has(sig.id) || alreadyRaised.has(sig.id)) continue
    limbo.push(sig.id)
    const trace = newTrace({ id: idGen(), now })
    const s = span(trace, 'reconcile', { id: idGen(), now })
    const tuple = fourTuple({ session: opts.session, run: trace.traceId })
    const inc = w('incidents', stamp({
      kind: 'incident', status: 'open', signal: sig.id,
      reason: 'signal received but no terminal outcome (limbo)',
      summary: sig.summary ?? null,
    }, s, tuple))
    raised.push(inc.id)
  }
  return { checked: signals.length, limbo, raised }
}

// ── thin CLI ──────────────────────────────────────────────────────────────────
function main() {
  const r = sweep()
  if (!r.raised.length) process.stdout.write(`reconcile: ${r.checked} signals, 0 limbo — clean.\n`)
  else process.stdout.write(`reconcile: ${r.checked} signals, ${r.limbo.length} limbo → raised ${r.raised.join(', ')}\n`)
  process.exitCode = r.raised.length ? 3 : 0
}
if (import.meta.url === `file://${process.argv[1]}`) main()
