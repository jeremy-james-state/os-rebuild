import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimate, rank } from './index.mjs'

test('a ready, high-confidence incident scores higher than a low-confidence unknown', () => {
  const hot = estimate({ type: 'incident', confidence: 'high', target: 'investigator' })
  const cold = estimate({ type: 'unknown', confidence: 'low', target: 'unknown' })
  assert.ok(hot.score > cold.score, `${hot.score} > ${cold.score}`)
  assert.equal(hot.band, 'high')
})

test('readiness matters: an unknown target drops readiness to 0', () => {
  const ready = estimate({ type: 'build', confidence: 'medium', target: 'orchestrator' })
  const notReady = estimate({ type: 'build', confidence: 'medium', target: 'unknown' })
  assert.equal(ready.factors.readiness, 1)
  assert.equal(notReady.factors.readiness, 0)
  assert.ok(ready.score > notReady.score)
})

test('score is bounded 0..100 with a band', () => {
  const e = estimate({ type: 'check', confidence: 'high', target: 'doctor' })
  assert.ok(e.score >= 0 && e.score <= 100)
  assert.ok(['high', 'medium', 'low'].includes(e.band))
})

test('deterministic: same item → same score', () => {
  assert.deepEqual(estimate({ type: 'build', confidence: 'high', target: 'x' }),
                   estimate({ type: 'build', confidence: 'high', target: 'x' }))
})

test('rank tolerates a missing/null backlog (yields [], never throws)', () => {
  assert.deepEqual(rank(null), [])
  assert.deepEqual(rank(undefined), [])
  assert.deepEqual(rank('nonsense'), [])
})

test('rank orders a backlog highest-priority first, stable on ties', () => {
  const ranked = rank([
    { type: 'unknown', confidence: 'low', target: 'unknown' },
    { type: 'incident', confidence: 'high', target: 'investigator' },
    { type: 'check', confidence: 'high', target: 'doctor' },
  ])
  assert.equal(ranked[0].item.type, 'incident')          // top priority
  assert.ok(ranked[0].score >= ranked[1].score && ranked[1].score >= ranked[2].score)
})
