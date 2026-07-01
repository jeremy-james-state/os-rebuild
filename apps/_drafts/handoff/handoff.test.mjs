// handoff tests — node:test, zero deps. The deterministic save-location + 7-section guard.
// These tests are what make the record/handoffs/ location UN-REGRESSABLE: if save() ever writes
// somewhere else, or drops docs/RESUME-HERE.md, or the section set changes, they fail and the merge
// gate rejects the change.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import {
  parseHandoff, missingSections, isComplete, save, scaffold, listHandoffs, SECTIONS,
  handoffsDir, resumePath,
} from './handoff.mjs'

const BODY = `## Current state (one line)
On main: the deterministic loop is taking shape.

## Mission
A governed operating system for Claude Code, bounded.

## Working model
Claude orchestrates; the human reviews and merges via the gate.

## What's on main
- doctor, governance-check, structure-check
- the incident loop

## In flight
- this branch: bring handoff into the harness

## Next steps
1. Merge through the gate.

## Gotchas / constraints
- Runtime jsonl under record/ is gitignored.
`

test('save() writes the dated file UNDER record/handoffs/ with the date-derived name', () => {
  const root = mkdtempSync(join(tmpdir(), 'handoff-'))
  const r = save(BODY, { root, date: '2026-07-01', session: 's1', gitHead: 'abc1234' })
  // The location guarantee: path is under record/handoffs/ and named handoff-<date>.md.
  assert.equal(r.datedPath, join(root, 'record', 'handoffs', 'handoff-2026-07-01.md'))
  assert.ok(r.datedPath.startsWith(handoffsDir(root) + sep), 'dated file is under record/handoffs/')
  assert.match(r.datedPath, /record[\\/]handoffs[\\/]handoff-2026-07-01\.md$/)
  assert.ok(existsSync(r.datedPath), 'dated file exists on disk')
  assert.equal(r.id, 'handoff-2026-07-01')
})

test('save() writes the header (id/session/git_head) + the body into the dated file', () => {
  const root = mkdtempSync(join(tmpdir(), 'handoff-'))
  const r = save(BODY, { root, date: '2026-07-01', session: 's1', gitHead: 'abc1234' })
  const md = readFileSync(r.datedPath, 'utf8')
  assert.match(md, /- \*\*id:\*\* handoff-2026-07-01/)
  assert.match(md, /- \*\*session:\*\* s1/)
  assert.match(md, /- \*\*git_head:\*\* abc1234/)
  // The body's sections are present and complete.
  assert.deepEqual(missingSections(parseHandoff(md)), [])
  assert.equal(isComplete(parseHandoff(md)), true)
})

test('save() overwrites docs/RESUME-HERE.md at its guaranteed path with the same body', () => {
  const root = mkdtempSync(join(tmpdir(), 'handoff-'))
  const r = save(BODY, { root, date: '2026-07-01' })
  assert.equal(r.resumePath, join(root, 'docs', 'RESUME-HERE.md'))
  assert.equal(r.resumePath, resumePath(root))
  assert.ok(existsSync(r.resumePath), 'RESUME-HERE.md exists on disk')
  const resume = readFileSync(r.resumePath, 'utf8')
  assert.match(resume, /# RESUME HERE/)
  assert.match(resume, /Do not edit by hand/)
  // Same seven sections as the dated file → complete.
  assert.deepEqual(missingSections(parseHandoff(resume)), [])
})

test('the caller cannot redirect the save — location is derived from root, not passed', () => {
  const root = mkdtempSync(join(tmpdir(), 'handoff-'))
  // Even if a bogus path is smuggled in as an extra field, it is ignored — the path is computed.
  const r = save(BODY, { root, date: '2026-07-01', datedPath: '/tmp/evil.md', resumePath: '/tmp/evil2.md' })
  assert.equal(r.datedPath, join(root, 'record', 'handoffs', 'handoff-2026-07-01.md'))
  assert.equal(r.resumePath, join(root, 'docs', 'RESUME-HERE.md'))
  assert.ok(!existsSync('/tmp/evil.md') || readFileSync('/tmp/evil.md', 'utf8') !== BODY)
})

test('an incomplete handoff is flagged (missing sections detected)', () => {
  const md = `## Current state (one line)
here

## Mission
<one paragraph>

## Working model
here

## What's on main
- x

## In flight

## Next steps
1. go

## Gotchas / constraints
- y
`
  const miss = missingSections(parseHandoff(md))
  assert.ok(miss.includes('mission'), 'angle-bracket placeholder = missing')
  assert.ok(miss.includes('inFlight'), 'empty section body = missing')
  assert.ok(!miss.includes('currentState'))
  assert.equal(isComplete(parseHandoff(md)), false)
})

test('a fully-filled handoff is complete across all seven sections', () => {
  const p = parseHandoff(BODY)
  assert.deepEqual(missingSections(p), [])
  assert.equal(isComplete(p), true)
  assert.equal(SECTIONS.length, 7)
})

test('scaffold writes an empty (template) handoff under record/handoffs/ — all sections missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'handoff-'))
  const r = scaffold({ root, date: '2026-07-01' })
  assert.equal(r.created, true)
  assert.ok(existsSync(r.datedPath))
  assert.ok(r.datedPath.startsWith(handoffsDir(root) + sep))
  const p = parseHandoff(readFileSync(r.datedPath, 'utf8'))
  assert.deepEqual(missingSections(p), SECTIONS.map((s) => s.key)) // all placeholders on a fresh scaffold
})

test('listHandoffs reports missing sections, ignoring README/_template', () => {
  const root = mkdtempSync(join(tmpdir(), 'handoff-'))
  const dir = handoffsDir(root)
  save(BODY, { root, date: '2026-07-01' })
  writeFileSync(join(dir, 'README.md'), '# readme')
  writeFileSync(join(dir, '_template.md'), '# template')
  const list = listHandoffs(dir)
  assert.equal(list.length, 1)
  assert.equal(list[0].file, 'handoff-2026-07-01.md')
  assert.equal(list[0].missing.length, 0)
})
