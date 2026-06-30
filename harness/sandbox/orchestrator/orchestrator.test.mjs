import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runLoop } from './index.mjs'
import { read } from '../loop-store/index.mjs'

function tmp() { return mkdtempSync(join(tmpdir(), 'orch-')) }
const fixedNow = () => '2026-07-01T00:00:00.000Z'
// deterministic id generator
function ids() { let k = 0; return () => `id-${k++}` }

test('a drift request flows extract→classify→estimate→route→completed, and the data layer fills', () => {
  const dir = tmp()
  try {
    const r = runLoop({ summary: 'check the harness for drift' },
      { dir, now: fixedNow, idGen: ids(), session: 's1', handlers: { doctor: () => ({ ok: true, errors: 0 }) } })
    assert.equal(r.classification.target, 'doctor')
    assert.equal(r.outcome.status, 'completed')
    assert.equal(r.feedback.length, 5)
    // every stream got exactly one row — nothing dropped along the way
    for (const s of ['signals', 'classified', 'estimates', 'runs']) {
      assert.equal(read(s, dir).records.length, 1, `${s} should have 1 row`)
    }
    // the run row carries the four-tuple + the same trace as the signal
    const run = read('runs', dir).records[0]
    assert.equal(run.session, 's1')
    assert.equal(run.traceId, read('signals', dir).records[0].traceId)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('an unmatched signal reaches an explicit unknown outcome — never silent, never faked', () => {
  const dir = tmp()
  try {
    const r = runLoop({ summary: 'lorem ipsum nonsense' }, { dir, now: fixedNow, idGen: ids() })
    assert.equal(r.classification.target, 'unknown')
    assert.equal(r.outcome.status, 'unknown')
    assert.match(r.outcome.reason, /no live handler/)
    assert.equal(read('runs', dir).records[0].status, 'unknown')   // recorded, not dropped
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('no ghost dispatch: a target with no real handler never reports completed', () => {
  const dir = tmp()
  try {
    // 'build' classifies to target 'orchestrator', which has no live handler here
    const r = runLoop({ summary: 'build the new thing' }, { dir, now: fixedNow, idGen: ids() })
    assert.notEqual(r.outcome.status, 'completed')
    assert.equal(r.outcome.status, 'unknown')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a throwing handler yields failed (errors are surfaced, not swallowed)', () => {
  const dir = tmp()
  try {
    const r = runLoop({ summary: 'check drift' },
      { dir, now: fixedNow, idGen: ids(), handlers: { doctor: () => { throw new Error('boom') } } })
    assert.equal(r.outcome.status, 'failed')
    assert.match(r.outcome.error, /boom/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('outcome is ALWAYS one of completed|unknown|failed (closed loop)', () => {
  const dir = tmp()
  try {
    for (const s of ['check drift', 'the build failed', 'what is this?', 'zzz', 'implement x']) {
      const r = runLoop({ summary: s }, { dir, now: fixedNow, idGen: ids(), handlers: { doctor: () => ({ ok: true }) } })
      assert.ok(['completed', 'unknown', 'failed'].includes(r.outcome.status), `${s} → ${r.outcome.status}`)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a DROPPED signal write yields an explicit failed outcome — never a false completed', () => {
  const dir = tmp()
  try {
    mkdirSync(join(dir, 'signals.jsonl'))   // force the signals append to drop (EISDIR)
    const r = runLoop({ summary: 'check drift' },
      { dir, now: fixedNow, idGen: ids(), handlers: { doctor: () => ({ ok: true }) } })
    assert.equal(r.outcome.status, 'failed')                 // not 'completed'
    assert.match(r.outcome.error, /dropped/)
    assert.equal(r.signal.ok, false)                         // the drop is acknowledged
    assert.ok(r.feedback.some((l) => /DROPPED/.test(l)))     // and visible
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('deterministic trace: injected ids make the run reproducible', () => {
  const dir1 = tmp(); const dir2 = tmp()
  try {
    const a = runLoop({ summary: 'check drift' }, { dir: dir1, now: fixedNow, idGen: ids(), handlers: { doctor: () => ({ ok: true }) } })
    const b = runLoop({ summary: 'check drift' }, { dir: dir2, now: fixedNow, idGen: ids(), handlers: { doctor: () => ({ ok: true }) } })
    assert.equal(a.trace.traceId, b.trace.traceId)       // 'id-0' both times
    assert.deepEqual(a.feedback, b.feedback)
  } finally { rmSync(dir1, { recursive: true, force: true }); rmSync(dir2, { recursive: true, force: true }) }
})
