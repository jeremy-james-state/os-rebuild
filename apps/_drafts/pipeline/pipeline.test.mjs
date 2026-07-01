import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runChain, approve, status, STAGES } from './index.mjs'
import { read } from '../../../harness/loop/loop-store/index.mjs'

function tmp() { return mkdtempSync(join(tmpdir(), 'pipe-')) }
const fixedNow = () => '2026-07-01T00:00:00.000Z'

test('the chain stops at the first gate (recorded, not blocking)', () => {
  const dir = tmp()
  try {
    const r = runChain({ id: 'w1', summary: 'ship a thing' }, { dir, now: fixedNow })
    assert.equal(r.status, 'awaiting-gate')
    assert.equal(r.stage, STAGES[0])          // pre-frame
    const s = status('w1', { dir })
    assert.deepEqual(s.pending, [STAGES[0]])  // one pending gate
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('approving a gate lets the next run resume to the following gate', () => {
  const dir = tmp()
  try {
    let r = runChain({ id: 'w1', summary: 'x' }, { dir, now: fixedNow })
    assert.equal(r.stage, 'pre-frame')
    approve(r.gateId, { dir, now: fixedNow })
    r = runChain({ id: 'w1', summary: 'x' }, { dir, now: fixedNow })
    assert.equal(r.status, 'awaiting-gate')
    assert.equal(r.stage, 'frame')            // advanced exactly one stage
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('approving every gate walks the whole chain to complete', () => {
  const dir = tmp()
  try {
    let r, guard = 0
    do {
      r = runChain({ id: 'w1', summary: 'full walk' }, { dir, now: fixedNow })
      if (r.status === 'awaiting-gate') approve(r.gateId, { dir, now: fixedNow })
    } while (r.status !== 'complete' && guard++ < 20)
    assert.equal(r.status, 'complete')
    assert.deepEqual(status('w1', { dir }).done.sort(), [...STAGES].sort())
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('un-gated stages flow without stopping', () => {
  const dir = tmp()
  try {
    // gate only 'deploy' → it should run straight through to the deploy gate
    const r = runChain({ id: 'w1', summary: 'fast' }, { dir, now: fixedNow, gates: ['deploy'] })
    assert.equal(r.status, 'awaiting-gate')
    assert.equal(r.stage, 'deploy')
    const s = status('w1', { dir })
    assert.ok(['pre-frame', 'frame', 'scope', 'design', 'build'].every((st) => s.done.includes(st)))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a work id containing the separator (::) still resumes after approval (no deadlock)', () => {
  const dir = tmp()
  try {
    const id = 'work::42'                                // wid itself contains '::'
    let r = runChain({ id, summary: 'compound id' }, { dir, now: fixedNow })
    assert.equal(r.stage, 'pre-frame')
    assert.equal(r.gateId, 'work::42::pre-frame')
    approve(r.gateId, { dir, now: fixedNow })
    r = runChain({ id, summary: 'compound id' }, { dir, now: fixedNow })
    assert.equal(r.status, 'awaiting-gate')
    assert.equal(r.stage, 'frame')                       // advanced — not stuck at pre-frame
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('approve is idempotent', () => {
  const dir = tmp()
  try {
    runChain({ id: 'w1', summary: 'x' }, { dir, now: fixedNow })
    const a = approve('w1::pre-frame', { dir, now: fixedNow })
    const b = approve('w1::pre-frame', { dir, now: fixedNow })
    assert.equal(a.already, false)
    assert.equal(b.already, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('stages never fake a runner — each records an honest stub + its owner', () => {
  const dir = tmp()
  try {
    runChain({ id: 'w1', summary: 'x' }, { dir, now: fixedNow, gates: [] })  // no gates → run all
    const chain = read('chain', dir).records
    assert.equal(chain.length, STAGES.length)
    assert.ok(chain.every((c) => c.status === 'stub' && c.owner))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
