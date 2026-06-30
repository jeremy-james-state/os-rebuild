import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { append, read, gaps, project, STREAMS } from './index.mjs'

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

test('STREAMS excludes the governance-ledger (different shape, not loop data)', () => {
  assert.equal(STREAMS.includes('governance-ledger'), false)
  assert.deepEqual(STREAMS, ['signals', 'runs', 'classified', 'estimates', 'reconcile', 'incidents', 'chain', 'gates'])
})
