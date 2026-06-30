import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newTrace, span, fourTuple, stamp } from './index.mjs'

test('newTrace: mints a traceId and is deterministic when injected', () => {
  const t = newTrace({ id: 'trace-1', now: () => '2026-07-01T00:00:00.000Z' })
  assert.equal(t.traceId, 'trace-1')
  assert.equal(t.spanId, null)
  assert.equal(t.parentSpanId, null)
  assert.equal(t.startedAt, '2026-07-01T00:00:00.000Z')
})

test('span: carries the trace id and links child to parent', () => {
  const t = newTrace({ id: 'trace-1' })
  const a = span(t, 'extract', { id: 'span-a' })
  const b = span(a, 'classify', { id: 'span-b' })
  assert.equal(a.traceId, 'trace-1')
  assert.equal(a.parentSpanId, null)        // first hop has no parent span
  assert.equal(b.traceId, 'trace-1')        // same trace across hops
  assert.equal(b.parentSpanId, 'span-a')    // linked to the previous hop
  assert.equal(b.name, 'classify')
})

test('span: refuses a context without a traceId (no silent ghost trace)', () => {
  assert.throws(() => span({}, 'classify'), /traceId/)
})

test('fourTuple: explicit values win; missing branch is filled or null', () => {
  const ft = fourTuple({ session: 's1', run: 'r1', call: 3, branch: 'work/loop-spine' })
  assert.deepEqual(ft, { session: 's1', run: 'r1', call: 3, branch: 'work/loop-spine' })
  const partial = fourTuple({ session: 's2' })
  assert.equal(partial.session, 's2')
  assert.equal(partial.run, 's2')           // run defaults to session today
  assert.equal(partial.call, null)
})

test('stamp: merges trace context (and optional four-tuple) onto a row', () => {
  const t = newTrace({ id: 'trace-1' })
  const s = span(t, 'extract', { id: 'span-a' })
  const row = stamp({ phase: 'received' }, s, { session: 's1', run: 'r1', call: 1, branch: 'b' })
  assert.equal(row.phase, 'received')
  assert.equal(row.traceId, 'trace-1')
  assert.equal(row.spanId, 'span-a')
  assert.equal(row.session, 's1')
  assert.equal(row.call, 1)
})

test('stamp: without a four-tuple leaves provenance untouched', () => {
  const t = newTrace({ id: 'trace-1' })
  const row = stamp({ x: 1 }, t)
  assert.equal(row.traceId, 'trace-1')
  assert.equal(row.spanId, null)
  assert.equal('session' in row, false)     // no four-tuple passed → not invented
})
