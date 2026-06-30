import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { append, read } from '../loop-store/index.mjs'
import { sweep } from './index.mjs'

function tmp() { return mkdtempSync(join(tmpdir(), 'recon-')) }
const fixedNow = () => '2026-07-01T00:00:00.000Z'
function ids() { let k = 0; return () => `rid-${k++}` }

test('raises an incident for a signal that never reached an outcome (limbo)', () => {
  const dir = tmp()
  try {
    append('signals', { summary: 'covered' }, { dir, now: fixedNow })   // signals:1
    append('signals', { summary: 'limbo!' }, { dir, now: fixedNow })    // signals:2 — no run
    append('runs', { signal: 'signals:1', status: 'completed' }, { dir, now: fixedNow })
    const r = sweep({ dir, now: fixedNow, idGen: ids() })
    assert.deepEqual(r.limbo, ['signals:2'])
    assert.equal(r.raised.length, 1)
    const inc = read('incidents', dir).records[0]
    assert.equal(inc.signal, 'signals:2')
    assert.equal(inc.status, 'open')
    assert.match(inc.reason, /limbo/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('idempotent: a second sweep raises nothing new', () => {
  const dir = tmp()
  try {
    append('signals', { summary: 'limbo' }, { dir, now: fixedNow })
    const first = sweep({ dir, now: fixedNow, idGen: ids() })
    assert.equal(first.raised.length, 1)
    const second = sweep({ dir, now: fixedNow, idGen: ids() })
    assert.equal(second.raised.length, 0)                  // already raised → not duplicated
    assert.equal(read('incidents', dir).records.length, 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a signal with ANY terminal run (even unknown) is not limbo', () => {
  const dir = tmp()
  try {
    append('signals', { summary: 'x' }, { dir, now: fixedNow })
    append('runs', { signal: 'signals:1', status: 'unknown' }, { dir, now: fixedNow })
    const r = sweep({ dir, now: fixedNow, idGen: ids() })
    assert.deepEqual(r.limbo, [])
    assert.equal(r.raised.length, 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('clean data layer → nothing raised', () => {
  const dir = tmp()
  try {
    const r = sweep({ dir, now: fixedNow, idGen: ids() })
    assert.deepEqual(r, { checked: 0, limbo: [], raised: [] })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
