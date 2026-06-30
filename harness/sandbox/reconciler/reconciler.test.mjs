import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { append, read } from '../loop-store/index.mjs'
import { sweep } from './index.mjs'

function tmp() { return mkdtempSync(join(tmpdir(), 'recon-')) }
const fixedNow = () => '2026-07-01T00:00:00.000Z'
function ids() { let k = 0; return () => `rid-${k++}` }
// isolate the drops file per test so the global state/ file never leaks in
const opt = (dir) => ({ dir, dropsPath: join(dir, 'drops.jsonl'), now: fixedNow, idGen: ids() })

test('raises an incident for a signal that never reached an outcome (limbo)', () => {
  const dir = tmp()
  try {
    append('signals', { summary: 'covered' }, { dir, now: fixedNow })   // signals:1
    append('signals', { summary: 'limbo!' }, { dir, now: fixedNow })    // signals:2 — no run
    append('runs', { signal: 'signals:1', status: 'completed' }, { dir, now: fixedNow })
    const r = sweep(opt(dir))
    assert.deepEqual(r.limbo, ['signals:2'])
    assert.equal(r.raised.length, 1)
    const inc = read('incidents', dir).records[0]
    assert.equal(inc.signal, 'signals:2')
    assert.equal(inc.status, 'open')
    assert.equal(inc.cause, 'limbo')
    assert.match(inc.reason, /limbo/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('idempotent: a second sweep raises nothing new', () => {
  const dir = tmp()
  try {
    append('signals', { summary: 'limbo' }, { dir, now: fixedNow })
    const first = sweep(opt(dir))
    assert.equal(first.raised.length, 1)
    const second = sweep(opt(dir))
    assert.equal(second.raised.length, 0)
    assert.equal(read('incidents', dir).records.length, 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a signal with ANY terminal run (even unknown) is not limbo', () => {
  const dir = tmp()
  try {
    append('signals', { summary: 'x' }, { dir, now: fixedNow })
    append('runs', { signal: 'signals:1', status: 'unknown' }, { dir, now: fixedNow })
    const r = sweep(opt(dir))
    assert.deepEqual(r.limbo, [])
    assert.equal(r.raised.length, 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('clean data layer → nothing raised', () => {
  const dir = tmp()
  try {
    const r = sweep(opt(dir))
    assert.deepEqual(r, { checked: 0, limbo: [], raised: [] })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('raises for a capture whose signals-stream write was DROPPED (authoritative over drops)', () => {
  const dir = tmp()
  try {
    // simulate a drop marker as loop-store would write it for a failed signals append
    writeFileSync(join(dir, 'drops.jsonl'),
      JSON.stringify({ ts: '2026-07-01T00:00:00.000Z', stage: 'append', stream: 'signals', n: 1, reason: 'EIO', record: { id: 'signals:1' } }) + '\n')
    const r = sweep(opt(dir))
    assert.deepEqual(r.limbo, ['signals:1'])
    assert.equal(r.raised.length, 1)
    const inc = read('incidents', dir).records[0]
    assert.equal(inc.cause, 'dropped-write')
    // idempotent across sweeps
    assert.equal(sweep(opt(dir)).raised.length, 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
