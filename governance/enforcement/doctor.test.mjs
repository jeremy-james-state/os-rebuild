// governance/enforcement/doctor.test.mjs — proves the drift-check catches real drift.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkComponents, checkDependencies, checkSequence,
  checkChain, checkMdSync, runDoctor, checkSchemas,
} from './doctor.mjs'
import { render } from '../../harness/render.mjs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

test('checkSchemas: the live harness definition conforms to its schemas (no drift)', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
  assert.deepEqual(checkSchemas(root), [])
})

test('checkSchemas: a manifest that violates its schema is flagged ERROR', () => {
  const root = mkdtempSync(join(tmpdir(), 'schematest-'))
  mkdirSync(join(root, 'harness'), { recursive: true })
  // schema requires manifestVersion; omit it
  writeFileSync(join(root, 'harness/manifest.schema.json'), JSON.stringify({
    type: 'object', required: ['manifestVersion'], additionalProperties: false,
    properties: { manifestVersion: { type: 'string' } },
  }))
  writeFileSync(join(root, 'harness/manifest.json'), JSON.stringify({ nope: true }))
  const out = checkSchemas(root)
  assert.ok(out.some(f => f.severity === 'ERROR' && f.code === 'manifest-schema-violation'), 'flags the violation')
  rmSync(root, { recursive: true, force: true })
})

function tmpRoot() { return mkdtempSync(join(tmpdir(), 'harness-doctor-')) }
const codes = (fs) => fs.map(f => f.code)
const sev = (fs, s) => fs.filter(f => f.severity === s)

test('checkComponents: flags declared-but-absent and bad-state', () => {
  const root = tmpRoot()
  try {
    mkdirSync(join(root, 'real'))
    writeFileSync(join(root, 'real', 'x.mjs'), '//')
    const manifest = {
      states: ['production', 'sandbox'],
      components: [
        { id: 'present', kind: 'tool', state: 'production', path: 'real', role: 'r' },
        { id: 'gone', kind: 'tool', state: 'production', path: 'missing-dir', role: 'r' },
        { id: 'weird', kind: 'tool', state: 'nonsense', path: 'real', role: 'r' },
      ],
    }
    const f = checkComponents(manifest, root)
    assert.ok(codes(f).includes('declared-but-absent'))
    assert.ok(codes(f).includes('bad-state'))
    // 'present' produces no finding
    assert.ok(!f.some(x => x.message.includes("'present'")))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkDependencies: missing dep + production-on-sandbox are ERROR; on-staging is WARN', () => {
  const manifest = {
    states: ['production', 'staging', 'sandbox'],
    components: [
      { id: 'prod', state: 'production', kind: 'x', path: 'p', role: 'r', dependsOn: ['ghost', 'sbx', 'stg'] },
      { id: 'sbx', state: 'sandbox', kind: 'x', path: 'p', role: 'r' },
      { id: 'stg', state: 'staging', kind: 'x', path: 'p', role: 'r' },
    ],
  }
  const f = checkDependencies(manifest)
  assert.ok(codes(f).includes('missing-dependency'))
  assert.ok(codes(f).includes('production-depends-on-unstable'))
  assert.ok(codes(f).includes('production-depends-on-staging'))
  assert.equal(sev(f, 'ERROR').length, 2) // ghost + sandbox
  assert.equal(sev(f, 'WARN').length, 1)  // staging
})

test('checkSequence: order gaps and bad refs are ERROR; unstable step is WARN', () => {
  const manifest = {
    states: ['production', 'sandbox'],
    components: [
      { id: 'a', state: 'production', kind: 'x', path: 'p', role: 'r' },
      { id: 'exp', state: 'sandbox', kind: 'x', path: 'p', role: 'r' },
    ],
    chain: { stages: [{ id: 'frame', status: 'present' }] },
    sequence: {
      steps: [
        { order: 1, id: 's1', phase: 'a', component: 'a' },
        { order: 3, id: 's2', phase: 'a', component: 'nope' }, // order gap + bad component
        { order: 4, id: 's3', phase: 'a', stage: 'ghoststage' }, // bad stage
        { order: 5, id: 's4', phase: 'a', component: 'exp' },    // unstable -> WARN
      ],
    },
  }
  const f = checkSequence(manifest, '/x')
  assert.ok(codes(f).includes('sequence-order-gap'))
  assert.ok(codes(f).includes('sequence-bad-component'))
  assert.ok(codes(f).includes('sequence-bad-stage'))
  assert.ok(codes(f).includes('sequence-step-unstable'))
})

test('checkSequence: clean, contiguous, fully-mapped sequence yields nothing', () => {
  const manifest = {
    states: ['production'],
    components: [{ id: 'a', state: 'production', kind: 'x', path: 'p', role: 'r' }],
    chain: { stages: [{ id: 'frame', status: 'present' }] },
    sequence: { steps: [{ order: 1, id: 's1', phase: 'a', component: 'a', stage: 'frame' }] },
  }
  assert.equal(checkSequence(manifest, '/x').length, 0)
})

test('checkChain: missing and partial stages warn', () => {
  const manifest = { chain: { stages: [
    { id: 'build', status: 'present' },
    { id: 'deploy', status: 'partial' },
    { id: 'monitor', status: 'missing' },
  ] } }
  const f = checkChain(manifest)
  assert.equal(f.length, 2)
  assert.ok(codes(f).includes('chain-stage-partial'))
  assert.ok(codes(f).includes('chain-stage-missing'))
})

test('checkMdSync: detects missing and stale MD twin, passes when in sync', () => {
  const root = tmpRoot()
  try {
    const manifest = {
      harnessVersion: '0.1.0', manifestVersion: '1.0', updated: '2026-06-30',
      states: ['production'], boundary: {},
      components: [{ id: 'a', state: 'production', kind: 'x', path: 'p', role: 'r' }],
    }
    mkdirSync(join(root, 'harness'))
    // missing
    assert.ok(codes(checkMdSync(manifest, root)).includes('md-twin-missing'))
    // stale
    writeFileSync(join(root, 'harness', 'manifest.md'), 'stale content')
    assert.ok(codes(checkMdSync(manifest, root)).includes('md-twin-stale'))
    // in sync
    writeFileSync(join(root, 'harness', 'manifest.md'), render(manifest))
    assert.equal(checkMdSync(manifest, root).length, 0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('runDoctor: unreadable manifest is a single ERROR', () => {
  const { findings } = runDoctor({ root: '/x', manifestPath: '/nope/does-not-exist.json' })
  assert.equal(findings.length, 1)
  assert.equal(findings[0].severity, 'ERROR')
  assert.equal(findings[0].code, 'manifest-unreadable')
})

test('runDoctor: unreadable registry is a single ERROR', () => {
  const { findings } = runDoctor({ root: '/x', registryPath: '/nope/does-not-exist.json' })
  assert.equal(findings.length, 1)
  assert.equal(findings[0].severity, 'ERROR')
  assert.equal(findings[0].code, 'registry-unreadable')
})

test('runDoctor: merges registry rows into the manifest (no fail-open)', () => {
  const { manifest } = runDoctor() // rails from manifest.json + rows from registry.json
  assert.ok(manifest && Array.isArray(manifest.components), 'merged shape exposes components')
  assert.ok(manifest.components.length > 0, 'registry rows merged in — not an empty/fail-open list')
})

test('runDoctor: the real repo manifest has zero ERRORs (boundary holds)', () => {
  const { findings, manifest } = runDoctor() // defaults to repo manifest + root
  assert.ok(manifest, 'manifest loaded')
  const errors = sev(findings, 'ERROR')
  assert.deepEqual(errors, [], `expected no drift, got: ${JSON.stringify(errors, null, 2)}`)
})
