// sync tests — node:test, no network. Mocks fetch; verifies transform + graceful degradation.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { toRows, sync } from './sync.mjs'

test('toRows keeps only create rows, the table columns, sorted by n', () => {
  const rows = toRows([
    { n: 2, op: 'create', id: 'signal:2', session: 's', extra: 'dropme' },
    { n: 1, op: 'create', id: 'signal:1', session: 's' },
    { op: 'state', n: 1, phase: 'resolved' }, // not a create → skipped
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].n, 1) // sorted
  assert.equal(rows[1].n, 2)
  assert.ok(!('extra' in rows[0]), 'only declared columns survive')
  assert.equal(rows[0].phase, null) // missing column → null
})

test('sync is a graceful no-op without credentials', async () => {
  const r = await sync({ url: undefined, key: undefined })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'no-credentials')
})

test('sync upserts via a merge-duplicates POST', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'synctest-'))
  const rec = join(dir, 'signals.jsonl')
  writeFileSync(rec, [
    { n: 1, op: 'create', id: 'signal:1', ts: 't', session: 's', call: 1, summary: 'hi' },
  ].map((r) => JSON.stringify(r)).join('\n') + '\n')

  let captured
  const fakeFetch = async (u, opts) => { captured = { u, opts }; return { ok: true, status: 200, text: async () => '' } }
  const r = await sync({ url: 'https://x.supabase.co', key: 'svc', recordFile: rec, fetchImpl: fakeFetch })

  assert.equal(r.ok, true); assert.equal(r.synced, 1)
  assert.match(captured.u, /\/rest\/v1\/os_signals$/)
  assert.equal(captured.opts.method, 'POST')
  assert.match(captured.opts.headers.prefer, /merge-duplicates/)
  assert.equal(JSON.parse(captured.opts.body)[0].summary, 'hi')
})

test('sync surfaces an HTTP error instead of throwing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'synctest-'))
  const rec = join(dir, 'signals.jsonl')
  writeFileSync(rec, JSON.stringify({ n: 1, op: 'create', id: 'signal:1' }) + '\n')
  const fakeFetch = async () => ({ ok: false, status: 401, text: async () => 'no key' })
  const r = await sync({ url: 'https://x.supabase.co', key: 'bad', recordFile: rec, fetchImpl: fakeFetch })
  assert.equal(r.ok, false)
  assert.match(r.reason, /http 401/)
})
