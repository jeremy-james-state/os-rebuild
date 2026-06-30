import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { append, read, gaps, duplicates, completeness, project, nextIndex, STREAMS } from './index.mjs'

function tmp() { return mkdtempSync(join(tmpdir(), 'loop-store-')) }
const fixedNow = () => '2026-07-01T00:00:00.000Z'

test('append: assigns gapless n and id <stream>:<n>, truth is readable', () => {
  const dir = tmp()
  try {
    const a = append('signals', { summary: 'first' }, { dir, now: fixedNow })
    assert.deepEqual({ ok: a.ok, n: a.n, id: a.id }, { ok: true, n: 1, id: 'signals:1' })
    append('signals', { summary: 'second' }, { dir, now: fixedNow })
    const { records } = read('signals', dir)
    assert.equal(records.length, 2)
    assert.equal(records[0].ts, '2026-07-01T00:00:00.000Z')
    assert.equal(records[1].n, 2)
    assert.deepEqual(gaps('signals', dir), [])     // provably complete
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('append: rejects an unknown stream (no silent mystery log)', () => {
  const dir = tmp()
  try { assert.throws(() => append('nonsense', {}, { dir }), /unknown stream/) }
  finally { rmSync(dir, { recursive: true, force: true }) }
})

test('project: rebuilds a readable events table + per-stream views', () => {
  const dir = tmp(); const db = join(dir, 'os.db')
  try {
    append('signals', { summary: 'hi', traceId: 't1', session: 's1', call: 1 }, { dir, now: fixedNow })
    append('runs', { status: 'completed', traceId: 't1', session: 's1', call: 2 }, { dir, now: fixedNow })
    const r = project({ dir, db })
    assert.equal(r.count, 2)
    assert.deepEqual(r.gaps, {})
    const sql = new DatabaseSync(db)
    const total = sql.prepare('SELECT count(*) AS c FROM events').get().c
    assert.equal(total, 2)
    const run = sql.prepare("SELECT * FROM runs").get()       // the view
    assert.equal(run.status, 'completed')
    assert.equal(run.trace_id, 't1')                          // same trace as the signal
    const sig = sql.prepare("SELECT * FROM signals").get()
    assert.equal(JSON.parse(sig.payload).summary, 'hi')       // lossless payload
    sql.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('duplicates() catches a duplicate-n that gaps() is blind to (completeness proof holds)', () => {
  const dir = tmp()
  try {
    // hand-write a corrupt truth log with a duplicate n (the concurrent-append failure mode)
    writeFileSync(join(dir, 'signals.jsonl'),
      '{"n":1,"id":"signals:1","stream":"signals","summary":"A"}\n' +
      '{"n":1,"id":"signals:1","stream":"signals","summary":"B"}\n' +
      '{"n":2,"id":"signals:2","stream":"signals","summary":"C"}\n')
    assert.deepEqual(gaps('signals', dir), [])          // gaps alone says "complete" — the blind spot
    assert.deepEqual(duplicates('signals', dir), [1])   // …but duplicates catches it
    const c = completeness('signals', dir)
    assert.equal(c.complete, false)
    assert.deepEqual(c.duplicates, [1])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('project() surfaces rows lost to duplicate-n instead of swallowing them', () => {
  const dir = tmp(); const db = join(dir, 'os.db')
  try {
    writeFileSync(join(dir, 'signals.jsonl'),
      '{"n":1,"id":"signals:1","stream":"signals"}\n{"n":1,"id":"signals:1","stream":"signals"}\n{"n":2,"id":"signals:2","stream":"signals"}\n')
    const r = project({ dir, db })
    assert.equal(r.rows, 3)            // read 3
    assert.equal(r.count, 2)           // projected 2 (PK collapse)
    assert.equal(r.lost, 1)            // …and the loss is reported, not hidden
    assert.deepEqual(r.duplicates.signals, [1])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('read() degrades (does not crash) on an unreadable stream file', () => {
  const dir = tmp()
  try {
    mkdirSync(join(dir, 'signals.jsonl'))               // a directory where a file is expected → EISDIR
    const r = read('signals', dir)
    assert.deepEqual(r.records, [])
    assert.equal(r.unreadable, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('append() returns a STABLE id even when the write is dropped', () => {
  const dir = tmp()
  try {
    mkdirSync(join(dir, 'signals.jsonl'))               // force appendFileSync to throw (EISDIR)
    const r = append('signals', { summary: 'x' }, { dir })
    assert.equal(r.ok, false)
    assert.equal(r.dropped, true)
    assert.equal(r.id, 'signals:1')                     // linkage never references undefined
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('nextIndex() handles a large stream without a Math.max spread cliff', () => {
  const dir = tmp()
  try {
    const lines = []
    for (let i = 1; i <= 150000; i++) lines.push(`{"n":${i},"id":"signals:${i}","stream":"signals"}`)
    writeFileSync(join(dir, 'signals.jsonl'), lines.join('\n') + '\n')
    assert.equal(nextIndex('signals', dir), 150001)     // reduce, not spread → no RangeError
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('STREAMS excludes the governance-ledger (different shape, not loop data)', () => {
  assert.equal(STREAMS.includes('governance-ledger'), false)
  assert.deepEqual(STREAMS, ['signals', 'runs', 'classified', 'estimates', 'reconcile', 'incidents', 'chain', 'gates'])
})
