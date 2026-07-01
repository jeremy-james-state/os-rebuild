import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decide, componentOf, writeTargets, isLive, lockPath, readLock, acquire } from './index.mjs'

function tmpRoot() {
  const root = mkdtempSync(join(tmpdir(), 'hlock-'))
  mkdirSync(join(root, 'harness', 'sandbox', 'target'), { recursive: true })
  return root
}
const NOW = Date.parse('2026-07-01T12:00:00.000Z')
const alive = () => true    // pid always alive
const dead = () => false    // pid never alive
// a write to the sandbox `target` component, from session A
const writeToTarget = (sid) => ({
  tool_name: 'Write',
  tool_input: { file_path: 'harness/sandbox/target/index.mjs' },
  session_id: sid,
})

test('componentOf: resolves sandbox and typed components; null off-harness', () => {
  assert.equal(componentOf('harness/sandbox/target/index.mjs', { root: '/r', cwd: '/r' }), 'target')
  assert.equal(componentOf('harness/runners/clarifier/x.mjs', { root: '/r', cwd: '/r' }), 'clarifier')
  assert.equal(componentOf('record/signals.jsonl', { root: '/r', cwd: '/r' }), null)
  assert.equal(componentOf('', { root: '/r', cwd: '/r' }), null)
})

test('writeTargets: writes counted, reads/other ignored', () => {
  assert.deepEqual(writeTargets('Write', { file_path: 'harness/sandbox/x/a.mjs' }), ['harness/sandbox/x/a.mjs'])
  assert.deepEqual(writeTargets('Read', { file_path: 'harness/sandbox/x/a.mjs' }), [])
  assert.deepEqual(writeTargets('Bash', { command: 'node --test harness/sandbox/x/x.test.mjs' }), [])
  assert.ok(writeTargets('Bash', { command: 'echo hi > harness/sandbox/x/a.txt' }).length === 1)
})

test('acquire → allow: first writer takes the lock', () => {
  const root = tmpRoot()
  try {
    const r = decide(writeToTarget('A'), { root, now: NOW, pidAlive: alive })
    assert.equal(r.block, false)
    assert.equal(r.component, 'target')
    assert.ok(existsSync(lockPath('target', root)))
    assert.equal(readLock('target', root).holder, 'A')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('same-holder re-entry → allow (a single actor never self-blocks)', () => {
  const root = tmpRoot()
  try {
    decide(writeToTarget('A'), { root, now: NOW, pidAlive: alive })
    const r = decide(writeToTarget('A'), { root, now: NOW, pidAlive: alive })
    assert.equal(r.block, false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('live foreign lock → BLOCK (exit 2 / block:true), naming the holder', () => {
  const root = tmpRoot()
  try {
    acquire('target', 'A', { root, now: NOW }) // A holds a fresh lock
    const r = decide(writeToTarget('B'), { root, now: NOW, pidAlive: alive })
    assert.equal(r.block, true)
    assert.equal(r.holder, 'A')
    assert.match(r.reason, /locked by another writer/)
    assert.match(r.reason, /holder=A/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('STALE (old ts) foreign lock → allow (re-acquire)', () => {
  const root = tmpRoot()
  try {
    acquire('target', 'A', { root, now: NOW - 3 * 60 * 60 * 1000 }) // 3h ago > 2h TTL
    const r = decide(writeToTarget('B'), { root, now: NOW, pidAlive: alive })
    assert.equal(r.block, false)
    assert.equal(readLock('target', root).holder, 'B') // B re-acquired
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('DEAD-pid foreign lock → allow (re-acquire)', () => {
  const root = tmpRoot()
  try {
    acquire('target', 'A', { root, now: NOW }) // fresh ts, but pid reported dead
    const r = decide(writeToTarget('B'), { root, now: NOW, pidAlive: dead })
    assert.equal(r.block, false)
    assert.equal(readLock('target', root).holder, 'B')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('isLive: TTL + pid gate', () => {
  assert.equal(isLive({ ts: new Date(NOW).toISOString(), pid: 1 }, { now: NOW, pidAlive: alive }), true)
  assert.equal(isLive({ ts: new Date(NOW).toISOString(), pid: 1 }, { now: NOW, pidAlive: dead }), false)
  assert.equal(isLive({ ts: new Date(NOW - 3 * 3600e3).toISOString(), pid: 1 }, { now: NOW, pidAlive: alive }), false)
  assert.equal(isLive(null, { now: NOW }), false)
  assert.equal(isLive({ pid: 1 }, { now: NOW }), false) // no ts
})

test('non-harness write → allow (no lock touched)', () => {
  const root = tmpRoot()
  try {
    const r = decide({ tool_name: 'Write', tool_input: { file_path: 'record/notes.md' }, session_id: 'A' }, { root, now: NOW, pidAlive: alive })
    assert.equal(r.block, false)
    assert.equal(r.component, undefined)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('read of a locked component → allow (reads never block)', () => {
  const root = tmpRoot()
  try {
    acquire('target', 'A', { root, now: NOW })
    const r = decide({ tool_name: 'Read', tool_input: { file_path: 'harness/sandbox/target/index.mjs' }, session_id: 'B' }, { root, now: NOW, pidAlive: alive })
    assert.equal(r.block, false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('malformed payload → allow (fail-open, never wedges)', () => {
  const root = tmpRoot()
  try {
    assert.equal(decide({}, { root, now: NOW }).block, false)
    assert.equal(decide({ tool_name: 'Write' }, { root, now: NOW }).block, false) // no tool_input
    assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'ls' } }, { root, now: NOW }).block, false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('corrupt lock file → allow (fail-open, re-acquire)', () => {
  const root = tmpRoot()
  try {
    mkdirSync(join(root, 'state', 'harness-locks'), { recursive: true })
    writeFileSync(lockPath('target', root), '{ not json')
    const r = decide(writeToTarget('B'), { root, now: NOW, pidAlive: alive })
    assert.equal(r.block, false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
