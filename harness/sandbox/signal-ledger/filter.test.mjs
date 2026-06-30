// filter tests — node:test, pure. The capture gate that keeps noise out of the truth log.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRealInput } from './filter.mjs'

test('keeps genuine user input', () => {
  assert.equal(isRealInput({ prompt: 'Yes, drop it.' }), true)
  assert.equal(isRealInput({ prompt: 'build the dashboard', hook_event_name: 'UserPromptSubmit' }), true)
})

test('drops system-injected turns', () => {
  assert.equal(isRealInput({ prompt: '<task-notification>\n<task-id>abc</task-id>' }), false)
  assert.equal(isRealInput({ prompt: '<system-reminder>\nThe task tools...' }), false)
  assert.equal(isRealInput({ prompt: 'Stop hook feedback:\n[~/.claude/...]' }), false)
  assert.equal(isRealInput({ prompt: '<github-webhook-activity>...' }), false)
})

test('drops empty / whitespace / missing prompts', () => {
  assert.equal(isRealInput({ prompt: '' }), false)
  assert.equal(isRealInput({ prompt: '   \n ' }), false)
  assert.equal(isRealInput({}), false)
})
