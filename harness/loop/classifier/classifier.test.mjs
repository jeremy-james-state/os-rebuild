import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify } from './index.mjs'

test('classifies a drift/check request to the doctor with high confidence', () => {
  const c = classify({ summary: 'check the harness for drift' })
  assert.equal(c.type, 'check'); assert.equal(c.target, 'doctor'); assert.equal(c.confidence, 'high')
})

test('classifies an incident to the investigator', () => {
  const c = classify({ summary: 'the build failed with an error' })
  assert.equal(c.type, 'incident'); assert.equal(c.target, 'investigator')
})

test('classifies a build request to the orchestrator (medium)', () => {
  const c = classify({ summary: 'implement the new feature' })
  assert.equal(c.type, 'build'); assert.equal(c.target, 'orchestrator'); assert.equal(c.confidence, 'medium')
})

test('a question is low confidence and target unknown (do not guess)', () => {
  const c = classify({ summary: 'what is the harness?' })
  assert.equal(c.type, 'question'); assert.equal(c.confidence, 'low'); assert.equal(c.target, 'unknown')
})

test('an unmatched signal is an explicit unknown, never silent, never fabricated', () => {
  const c = classify({ summary: 'lorem ipsum dolor sit' })
  assert.deepEqual(
    { type: c.type, intent: c.intent, confidence: c.confidence, target: c.target },
    { type: 'unknown', intent: 'unknown', confidence: 'low', target: 'unknown' },
  )
})

test('deterministic: same input → same classification', () => {
  const a = classify({ summary: 'check drift' })
  const b = classify({ summary: 'check drift' })
  assert.deepEqual(a, b)
})
