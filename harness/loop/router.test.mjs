// harness/loop/router.test.mjs — proves the wiring works (not described).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { route } from './router.mjs'

const tmpRec = () => join(mkdtempSync(join(tmpdir(), 'router-')), 'runs.jsonl')
const hasFourTuple = (row) =>
  ['session', 'run', 'call', 'branch'].every(k => k in row)

test('known signal routes to a component, completes, and records a run with the four-tuple', () => {
  const rec = tmpRec()
  const { outcome } = route({ type: 'check', intent: 'drift' },
    { recordPath: rec, now: '2026-06-30T00:00:00Z', run: 'r1', session: 's', branch: 'b' })
  assert.equal(outcome.status, 'completed')
  assert.equal(typeof outcome.result.ok, 'boolean')
  const rows = readFileSync(rec, 'utf8').trim().split('\n').map(l => JSON.parse(l))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].status, 'completed')
  assert.ok(hasFourTuple(rows[0]))
  rmSync(rec, { force: true })
})

test('unknown signal is recorded as unknown — never silently dropped', () => {
  const rec = tmpRec()
  const { outcome } = route({ type: 'nope', intent: 'whatever' },
    { recordPath: rec, run: 'r2', session: 's', branch: 'b' })
  assert.equal(outcome.status, 'unknown')
  const rows = readFileSync(rec, 'utf8').trim().split('\n').map(l => JSON.parse(l))
  assert.equal(rows[0].status, 'unknown')
  assert.ok(hasFourTuple(rows[0]))
  rmSync(rec, { force: true })
})
