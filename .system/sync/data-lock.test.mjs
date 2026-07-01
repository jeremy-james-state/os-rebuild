import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lock, verify, unlock, protectedFiles } from './data-lock.mjs'

const mac = process.platform === 'darwin'

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'datalock-'))
  mkdirSync(join(root, 'record/incidents'), { recursive: true })
  mkdirSync(join(root, 'record/handoffs'), { recursive: true })
  writeFileSync(join(root, 'record/governance-ledger.jsonl'), '{"id":"g1"}\n')
  writeFileSync(join(root, 'record/SCHEMA.md'), '# schema\n')
  writeFileSync(join(root, 'record/incidents/inc.md'), '# incident\n')
  writeFileSync(join(root, 'record/handoffs/h.md'), '# handoff\n')
  return root
}
function teardown(root) { try { unlock(root) } catch {} rmSync(root, { recursive: true, force: true }) }

test('protectedFiles finds the tracked append-only set', () => {
  const root = setup()
  try { assert.equal(protectedFiles(root).length, 4) } finally { teardown(root) }
})

test('lock PROVES append + overwrite + delete are all rejected (macOS)', () => {
  const root = setup()
  try {
    const r = lock(root)
    assert.equal(r.proof.platform, process.platform)
    if (mac) {
      assert.equal(r.proof.append, true)
      assert.equal(r.proof.overwrite, true)
      assert.equal(r.proof.delete, true)
      assert.equal(r.proof.allRejected, true)
    }
  } finally { teardown(root) }
})

test('after lock, a protected file cannot be appended or overwritten (macOS)', () => {
  const root = setup()
  try {
    lock(root)
    const f = join(root, 'record/governance-ledger.jsonl')
    if (mac) {
      assert.throws(() => appendFileSync(f, 'tamper'))
      assert.throws(() => writeFileSync(f, 'tamper'))
    }
    assert.equal(verify(root).ok, true)   // untouched
  } finally { teardown(root) }
})

test('verify is byte-identical after lock, and detects drift after a real edit', () => {
  const root = setup()
  try {
    lock(root)
    assert.equal(verify(root).ok, true)
    unlock(root)
    appendFileSync(join(root, 'record/SCHEMA.md'), 'edited\n')
    const v = verify(root)
    assert.equal(v.ok, false)
    assert.ok(v.drift.some((d) => d.rel.endsWith('SCHEMA.md') && d.reason === 'CHANGED'))
  } finally { teardown(root) }
})

test('unlock restores appendability (append-only data stays usable)', () => {
  const root = setup()
  try {
    lock(root)
    unlock(root)
    appendFileSync(join(root, 'record/handoffs/h.md'), 'next handoff\n')
    assert.match(readFileSync(join(root, 'record/handoffs/h.md'), 'utf8'), /next handoff/)
  } finally { teardown(root) }
})
