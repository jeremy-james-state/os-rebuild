// signal-ledger tests — node:test, zero external deps. Uses temp dirs; never touches real record/.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendSignal, readSignals, nextIndex, signalGaps, rebuildProjection } from './ledger.mjs'

function tmp() { return mkdtempSync(join(tmpdir(), 'sigtest-')) }
const opts = (dir) => ({ recordFile: join(dir, 'signals.jsonl'), dropFile: join(dir, 'drops.jsonl') })

test('appendSignal stamps the four-tuple and a monotonic index', () => {
  const dir = tmp(); const o = opts(dir)
  const r = appendSignal({ ...o, session: 'sess-1', branch: 'b1', source: 'UserPromptSubmit', summary: 'hello' })
  assert.equal(r.ok, true); assert.equal(r.n, 1); assert.equal(r.id, 'signal:1')
  const [rec] = readSignals(o.recordFile).records
  assert.equal(rec.session, 'sess-1'); assert.equal(rec.branch, 'b1')
  assert.equal(rec.call, 1); assert.equal(rec.run, 'sess-1') // run defaults to session today
  assert.equal(rec.source, 'UserPromptSubmit'); assert.equal(rec.phase, 'received')
})

test('appendSignal stamps the harness version + code sha (which definition produced the row)', () => {
  const dir = tmp(); const o = opts(dir); const db = join(dir, 'os.db')
  appendSignal({ ...o, session: 's', branch: 'b', summary: 'v', harnessVersion: '9.9.9', codeSha: 'deadbee' })
  const [rec] = readSignals(o.recordFile).records
  assert.equal(rec.harnessVersion, '9.9.9'); assert.equal(rec.codeSha, 'deadbee')
  rebuildProjection({ recordFile: o.recordFile, db }) // projection carries the columns
})

test('indexes increment and stay gapless across appends', () => {
  const dir = tmp(); const o = opts(dir)
  for (let i = 0; i < 5; i++) appendSignal({ ...o, session: 's', summary: `m${i}` })
  assert.equal(nextIndex(o.recordFile), 6)
  assert.deepEqual(signalGaps(o.recordFile), [])
})

test('signalGaps detects a planted hole', () => {
  const dir = tmp(); const o = opts(dir)
  writeFileSync(o.recordFile,
    [{ n: 1, op: 'create' }, { n: 3, op: 'create' }].map((r) => JSON.stringify(r)).join('\n') + '\n')
  assert.deepEqual(signalGaps(o.recordFile), [2])
})

test('rebuildProjection builds state/os.db and is idempotent', () => {
  const dir = tmp(); const o = opts(dir); const db = join(dir, 'os.db')
  for (let i = 0; i < 3; i++) appendSignal({ ...o, session: 's', branch: 'b', summary: `m${i}` })
  const a = rebuildProjection({ recordFile: o.recordFile, db })
  assert.equal(a.rows, 3); assert.deepEqual(a.gaps, [])
  const b = rebuildProjection({ recordFile: o.recordFile, db }) // rebuild again
  assert.equal(b.rows, 3) // no duplication — drop-and-rebuild
})

test('fail-open: an unwritable record path is recorded as a drop, never thrown', () => {
  const dir = tmp()
  const asFile = join(dir, 'afile'); writeFileSync(asFile, 'x') // a file where a dir is expected
  const o = { recordFile: join(asFile, 'signals.jsonl'), dropFile: join(dir, 'drops.jsonl') }
  const r = appendSignal({ ...o, session: 's', summary: 'will-drop' })
  assert.equal(r.ok, false); assert.equal(r.dropped, true)
  assert.ok(existsSync(o.dropFile), 'drop marker written')
  assert.match(readFileSync(o.dropFile, 'utf8'), /will-drop|record/)
})
