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
 * Two kinds of limbo are caught:
 *   • 'limbo'        — a persisted signal with no terminal run.
 *   • 'dropped-write'— a capture whose signals-stream WRITE was dropped (never reached the
 *                      stream); recorded in state/loop-store-drops.jsonl. The reconciler is
 *                      authoritative over drops so a lost capture is still reconciled.
 *
 * Idempotent: a signal already covered by a run OR already raised is not re-raised. read()
 * degrades on unreadable streams, so the sweep itself does not crash on a corrupt data layer.
 */
import { existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { read, append, dropPath } from '../loop-store/index.mjs'
import { newTrace, span, stamp, fourTuple } from '../tracer/index.mjs'

function readDroppedSignalIds(path) {
  if (!path || !existsSync(path)) return []
  let text
  try { text = readFileSync(path, 'utf8') } catch { return [] }
  const ids = []
  for (const line of text.split('\n').filter(Boolean)) {
    try { const d = JSON.parse(line); if (d.stage === 'append' && d.stream === 'signals' && d.record && d.record.id) ids.push(d.record.id) } catch {}
  }
  return ids
}

/**
 * Sweep for limbo signals (and dropped captures) and raise an incident for each new one.
 * Returns { checked, limbo: [signalId], raised: [incidentId] }.
 */
export function sweep(opts = {}) {
  const dir = opts.dir
  const dropsPath = opts.dropsPath || dropPath()
  const now = opts.now || (() => new Date().toISOString())
  const idGen = opts.idGen || (() => randomUUID())
  const rd = (s) => read(s, dir).records
  const w = (stream, row) => append(stream, row, dir ? { dir, now } : { now })

  const signals = rd('signals')
  const incidents = rd('incidents')
  const coveredByRun = new Set(rd('runs').map((r) => r.signal).filter(Boolean))
  const raisedLimbo = new Set(incidents.filter((i) => i.cause === 'limbo' && i.signal).map((i) => i.signal))
  const raisedDrop = new Set(incidents.filter((i) => i.cause === 'dropped-write' && i.signal).map((i) => i.signal))

  const limbo = []
  const raised = []
  const raise = (signalId, cause, reason, summary) => {
    const trace = newTrace({ id: idGen(), now })
    const s = span(trace, 'reconcile', { id: idGen(), now })
    const tuple = fourTuple({ session: opts.session, run: trace.traceId })
    const inc = w('incidents', stamp({ kind: 'incident', status: 'open', cause, signal: signalId, reason, summary: summary ?? null }, s, tuple))
    limbo.push(signalId)
    raised.push(inc.id)
  }

  // (1) persisted signals with no terminal run
  for (const sig of signals) {
    if (coveredByRun.has(sig.id) || raisedLimbo.has(sig.id)) continue
    raise(sig.id, 'limbo', 'signal received but no terminal outcome (limbo)', sig.summary)
  }
  // (2) captures whose signals-stream write was dropped (never reached the stream)
  for (const id of new Set(readDroppedSignalIds(dropsPath))) {
    if (raisedDrop.has(id)) continue
    raise(id, 'dropped-write', 'signal capture write was dropped — never reached the signals stream', null)
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
