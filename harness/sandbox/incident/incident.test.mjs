// incident tests — node:test, zero deps. The deterministic 5-step gate.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseIncident, missingSteps, isComplete, scaffold, listIncidents, STEPS } from './incident.mjs'

const COMPLETE = `# Incident — Thing (2026-06-30)
- **status:** resolved

## The five steps
1. **Root cause** — the confirmed cause, measured
2. **Recreated** — open two sessions, send a message
3. **Immediate fix** — reverted the hook
4. **Long-term solution** — transport belongs to the Data Layer
5. **Preventative** — hooks don't write to git
`

test('a fully-filled incident is complete', () => {
  const p = parseIncident(COMPLETE)
  assert.equal(p.status, 'resolved')
  assert.deepEqual(missingSteps(p), [])
  assert.equal(isComplete(p), true)
})

test('placeholder / empty steps are detected as missing', () => {
  const md = `- **status:** open
1. **Root cause** — <the confirmed cause>
2. **Recreated** — actually reproduced here
3. **Immediate fix** —
4. **Long-term solution** — done
5. **Preventative** — a check
`
  const miss = missingSteps(parseIncident(md))
  assert.ok(miss.includes('rootCause'), 'angle-bracket placeholder = missing')
  assert.ok(miss.includes('immediateFix'), 'empty = missing')
  assert.ok(!miss.includes('recreatedSteps'))
  assert.equal(isComplete(parseIncident(md)), false)
})

test('scaffold writes a file with all 5 step labels and status open (steps empty)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inc-'))
  const r = scaffold('My Test Incident', { dir, date: '2026-06-30' })
  assert.equal(r.created, true)
  assert.equal(r.id, 'incident-2026-06-30-my-test-incident')
  const md = readFileSync(r.file, 'utf8')
  for (const s of STEPS) assert.match(md, new RegExp(`\\*\\*${s.label}\\*\\*`), `has ${s.label}`)
  const p = parseIncident(md)
  assert.equal(p.status, 'open')
  assert.deepEqual(missingSteps(p), STEPS.map((s) => s.key)) // all empty on a fresh scaffold
})

test('scaffold is idempotent (does not overwrite)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inc-'))
  scaffold('Dup', { dir, date: '2026-06-30' })
  const second = scaffold('Dup', { dir, date: '2026-06-30' })
  assert.equal(second.created, false)
})

test('listIncidents reports status + missing, ignoring README/_template', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inc-'))
  writeFileSync(join(dir, 'README.md'), '# readme')
  writeFileSync(join(dir, '_template.md'), '# template')
  scaffold('One', { dir, date: '2026-06-30' })
  const list = listIncidents(dir)
  assert.equal(list.length, 1)
  assert.equal(list[0].status, 'open')
  assert.equal(list[0].missing.length, 5)
})
