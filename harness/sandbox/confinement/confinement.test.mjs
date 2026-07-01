import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { forbidden, targets, decide, REPO } from './index.mjs'

const HOME = process.env.HOME
const sibling = join(HOME, 'Projects', 'harness', 'execution/tests/root-shape.test.mjs')
const mine = join(REPO, 'record', 'signals.jsonl')

test('forbidden: a sibling project path is blocked; own repo + system are not', () => {
  assert.equal(forbidden(sibling), true)                                 // /Projects/harness → blocked
  assert.equal(forbidden(join(HOME, 'Projects', 'OS', 'x')), true)       // /Projects/OS → blocked
  assert.equal(forbidden(mine), false)                                   // os-rebuild → allowed
  assert.equal(forbidden('/usr/bin/node'), false)                        // system → allowed
  assert.equal(forbidden(join(HOME, '.claude', 'settings.json')), false) // ~/.claude (not under Projects) → allowed
})

test('targets: extracts the sibling path from a Bash cd command (the screenshot case)', () => {
  const t = targets('Bash', { command: `cd ${join(HOME, 'Projects', 'harness')}; node --test execution/tests/root-shape.test.mjs` })
  assert.ok(t.some((p) => p.includes('Projects/harness')))
})

test('decide: blocks a Bash cd into the Core; allows an in-repo Read', () => {
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: `cd ${join(HOME, 'Projects', 'harness')} && node --test` } }).block, true)
  assert.equal(decide({ tool_name: 'Read', tool_input: { file_path: sibling } }).block, true)
  assert.equal(decide({ tool_name: 'Read', tool_input: { file_path: mine } }).block, false)
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'node --test harness/sandbox/tracer/tracer.test.mjs' } }).block, false)
})

test('decide: catches a relative ../ escape into a sibling', () => {
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'cat ../harness/STATUS.md' }, cwd: REPO }).block, true)
})

test('decide: fails open on an unknown/empty payload (never wedges a session)', () => {
  assert.equal(decide({}).block, false)
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'ls' } }).block, false)
})
