// governance/checks/doctor.test.mjs — proves the drift-check catches real drift.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkComponents, checkDependencies, checkSequence,
  checkChain, checkMdSync, runDoctor, checkSchemas, checkSandboxContainment,
  checkVersionChangelog, checkIndexSync, checkChangelogSync, checkReleaseConsistency,
  checkVersionBumpOnChange,
} from './doctor.mjs'
import { render, renderIndex, renderChangelog } from '../../harness/render.mjs'
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

test('checkSandboxContainment: a _drafts-path row with an admitted state is ERROR; candidate/sandbox are clean (self-admission guard)', () => {
  const manifest = {
    components: [
      { id: 'ok-sandbox', kind: 'tool', type: 'library', state: 'sandbox', path: 'apps/_drafts/foo/', role: 'r' },
      { id: 'ok-candidate', kind: 'tool', type: 'library', state: 'candidate', path: 'apps/_drafts/qux/', role: 'r' },
      { id: 'self-admitted', kind: 'tool', type: 'library', state: 'production', path: 'apps/_drafts/bar/', role: 'r' },
      { id: 'promoted', kind: 'tool', type: 'library', state: 'production', path: 'apps/baz/', role: 'r' },
    ],
  }
  const f = checkSandboxContainment(manifest)
  // Only the self-admitted (production while still under _drafts/) is drift; candidate + sandbox are both allowed.
  assert.deepEqual(codes(f), ['drafts-path-non-candidate-state'])
  assert.equal(f[0].severity, 'ERROR')
  assert.ok(f[0].message.includes("'self-admitted'"))
})

test('checkVersionChangelog: version without/mismatched versions[] is ERROR', () => {
  const good = { components: [{ id: 'a', version: '1.2.0', versions: [{ version: '1.1.0' }, { version: '1.2.0' }] }] }
  assert.deepEqual(checkVersionChangelog(good), [])
  const noHist = { components: [{ id: 'b', version: '1.0.0' }] }
  assert.deepEqual(codes(checkVersionChangelog(noHist)), ['version-without-history'])
  const mismatch = { components: [{ id: 'c', version: '2.0.0', versions: [{ version: '1.0.0' }] }] }
  assert.deepEqual(codes(checkVersionChangelog(mismatch)), ['version-changelog-mismatch'])
})

test('checkIndexSync: stale/missing harness/index.md is ERROR; matching is clean', () => {
  const root = tmpRoot()
  try {
    mkdirSync(join(root, 'harness'), { recursive: true })
    const manifest = { components: [{ id: 'x', kind: 'k', type: 'library', state: 'sandbox', path: 'apps/_drafts/x/', role: 'r', version: '0.1.0' }] }
    assert.deepEqual(codes(checkIndexSync(manifest, root)), ['index-missing'])
    writeFileSync(join(root, 'harness/index.md'), renderIndex(manifest.components))
    assert.deepEqual(checkIndexSync(manifest, root), [])
    writeFileSync(join(root, 'harness/index.md'), 'stale\n')
    assert.deepEqual(codes(checkIndexSync(manifest, root)), ['index-stale'])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkChangelogSync: a stale per-component CHANGELOG.md is ERROR; matching/absent is clean', () => {
  const root = tmpRoot()
  try {
    const c = { id: 'x', path: 'comp/', version: '0.1.0', versions: [{ version: '0.1.0', date: '2026-07-01', change: 'init' }] }
    const manifest = { components: [c] }
    assert.deepEqual(checkChangelogSync(manifest, root), []) // absent → not checked
    mkdirSync(join(root, 'comp'), { recursive: true })
    writeFileSync(join(root, 'comp/CHANGELOG.md'), renderChangelog(c))
    assert.deepEqual(checkChangelogSync(manifest, root), [])
    writeFileSync(join(root, 'comp/CHANGELOG.md'), 'stale\n')
    assert.deepEqual(codes(checkChangelogSync(manifest, root)), ['changelog-stale'])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkReleaseConsistency: missing record + pin drift are ERROR; matching is clean', () => {
  const root = tmpRoot()
  try {
    const manifest = { harnessVersion: '0.9', components: [{ id: 'x', version: '0.1.0' }, { id: 'y', version: '0.2.0' }] }
    assert.deepEqual(codes(checkReleaseConsistency(manifest, root)), ['release-missing'])
    mkdirSync(join(root, '.system/releases'), { recursive: true })
    writeFileSync(join(root, '.system/releases/0.9.json'), JSON.stringify({ pins: { x: '0.1.0', y: '9.9.9' } }))
    assert.deepEqual(codes(checkReleaseConsistency(manifest, root)), ['release-pin-drift'])
    writeFileSync(join(root, '.system/releases/0.9.json'), JSON.stringify({ pins: { x: '0.1.0', y: '0.2.0' } }))
    assert.deepEqual(checkReleaseConsistency(manifest, root), [])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

// --- checkVersionBumpOnChange: a real tmp git repo with a release tag ---------
function gitRepoWithRelease() {
  const root = mkdtempSync(join(tmpdir(), 'harness-vbump-'))
  const g = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  g('init', '-q')
  g('config', 'user.email', 'test@example.com')
  g('config', 'user.name', 'test')
  // A component dir + a release record pinning it at 0.1.0, then tag it.
  mkdirSync(join(root, 'harness/comp'), { recursive: true })
  mkdirSync(join(root, '.system/releases'), { recursive: true })
  writeFileSync(join(root, 'harness/comp/index.mjs'), 'export const v = 1\n')
  writeFileSync(join(root, '.system/releases/0.8.json'), JSON.stringify({ pins: { comp: '0.1.0' } }))
  g('add', '-A')
  g('commit', '-q', '-m', 'seed')
  g('tag', 'harness-v0.8')
  return { root, g }
}

test('checkVersionBumpOnChange: changed component without a version bump is ERROR', () => {
  const { root, g } = gitRepoWithRelease()
  try {
    // Change the component file, then commit — version still equals its 0.8 pin.
    writeFileSync(join(root, 'harness/comp/index.mjs'), 'export const v = 2\n')
    g('add', '-A'); g('commit', '-q', '-m', 'change comp')
    const manifest = { components: [{ id: 'comp', path: 'harness/comp/', version: '0.1.0' }] }
    const f = checkVersionBumpOnChange(manifest, root)
    assert.deepEqual(codes(f), ['version-bump-required'])
    assert.equal(f[0].severity, 'ERROR')
    assert.ok(f[0].message.includes('harness-v0.8'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkVersionBumpOnChange: an UNCOMMITTED change without a version bump is ERROR (fires pre-commit)', () => {
  // Regression: the old code diffed `<tag>..HEAD`, so a working-tree edit that was
  // not yet committed produced NO diff and a false green. Branch verification runs
  // pre-commit, so the check MUST see the working tree. Modify the component file
  // without committing and assert the drift is now caught.
  const { root } = gitRepoWithRelease()
  try {
    writeFileSync(join(root, 'harness/comp/index.mjs'), 'export const v = 2\n') // NO git add / commit
    const manifest = { components: [{ id: 'comp', path: 'harness/comp/', version: '0.1.0' }] }
    const f = checkVersionBumpOnChange(manifest, root)
    assert.deepEqual(codes(f), ['version-bump-required'])
    assert.equal(f[0].severity, 'ERROR')
    assert.ok(f[0].message.includes('harness-v0.8'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkVersionBumpOnChange: same change WITH a bumped version is clean', () => {
  const { root, g } = gitRepoWithRelease()
  try {
    writeFileSync(join(root, 'harness/comp/index.mjs'), 'export const v = 2\n')
    g('add', '-A'); g('commit', '-q', '-m', 'change comp')
    // version now != pin → the bump was recorded, no drift.
    const manifest = { components: [{ id: 'comp', path: 'harness/comp/', version: '0.2.0' }] }
    assert.deepEqual(checkVersionBumpOnChange(manifest, root), [])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkVersionBumpOnChange: an unchanged component (no diff since tag) is clean', () => {
  const { root } = gitRepoWithRelease()
  try {
    // No commits since the tag → no diff → no finding even though version == pin.
    const manifest = { components: [{ id: 'comp', path: 'harness/comp/', version: '0.1.0' }] }
    assert.deepEqual(checkVersionBumpOnChange(manifest, root), [])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkVersionBumpOnChange: only CHANGELOG.md changed (generated) is not drift', () => {
  const { root, g } = gitRepoWithRelease()
  try {
    writeFileSync(join(root, 'harness/comp/CHANGELOG.md'), '# generated\n')
    g('add', '-A'); g('commit', '-q', '-m', 'regen changelog')
    const manifest = { components: [{ id: 'comp', path: 'harness/comp/', version: '0.1.0' }] }
    assert.deepEqual(checkVersionBumpOnChange(manifest, root), [])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkVersionBumpOnChange: only a *.test.mjs changed (test-only) is not drift; an index.mjs change still is', () => {
  const { root, g } = gitRepoWithRelease()
  try {
    // Test-only change since the tag → NOT flagged (tests aren't shipped behavior).
    writeFileSync(join(root, 'harness/comp/comp.test.mjs'), 'import "node:test"\n')
    g('add', '-A'); g('commit', '-q', '-m', 'add test')
    const manifest = { components: [{ id: 'comp', path: 'harness/comp/', version: '0.1.0' }] }
    assert.deepEqual(checkVersionBumpOnChange(manifest, root), [], 'a *.test.mjs-only change must not force a bump')
    // Now change the index.mjs (shipped behavior) without bumping → still flagged.
    writeFileSync(join(root, 'harness/comp/index.mjs'), 'export const v = 2\n')
    g('add', '-A'); g('commit', '-q', '-m', 'change index')
    const f = checkVersionBumpOnChange(manifest, root)
    assert.deepEqual(codes(f), ['version-bump-required'])
    assert.equal(f[0].severity, 'ERROR')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkVersionBumpOnChange: a component absent from the release pins is skipped', () => {
  const { root, g } = gitRepoWithRelease()
  try {
    // A brand-new component dir not present at the 0.8 baseline.
    mkdirSync(join(root, 'harness/newcomp'), { recursive: true })
    writeFileSync(join(root, 'harness/newcomp/index.mjs'), 'export const n = 1\n')
    g('add', '-A'); g('commit', '-q', '-m', 'add newcomp')
    const manifest = { components: [{ id: 'newcomp', path: 'harness/newcomp/', version: '0.1.0' }] }
    assert.deepEqual(checkVersionBumpOnChange(manifest, root), [])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkVersionBumpOnChange: fail-open — no git repo returns []', () => {
  const root = mkdtempSync(join(tmpdir(), 'harness-nogit-'))
  try {
    const manifest = { components: [{ id: 'comp', path: 'harness/comp/', version: '0.1.0' }] }
    assert.deepEqual(checkVersionBumpOnChange(manifest, root), [])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkVersionBumpOnChange: fail-open — git repo with no release tag returns []', () => {
  const root = mkdtempSync(join(tmpdir(), 'harness-notag-'))
  try {
    const g = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' })
    g('init', '-q'); g('config', 'user.email', 't@e.com'); g('config', 'user.name', 't')
    mkdirSync(join(root, 'harness/comp'), { recursive: true })
    writeFileSync(join(root, 'harness/comp/index.mjs'), '//\n')
    g('add', '-A'); g('commit', '-q', '-m', 'seed') // committed but never tagged harness-v*
    const manifest = { components: [{ id: 'comp', path: 'harness/comp/', version: '0.1.0' }] }
    assert.deepEqual(checkVersionBumpOnChange(manifest, root), [])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkVersionBumpOnChange: fail-open — tag present but release record missing returns []', () => {
  const root = mkdtempSync(join(tmpdir(), 'harness-norec-'))
  try {
    const g = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' })
    g('init', '-q'); g('config', 'user.email', 't@e.com'); g('config', 'user.name', 't')
    mkdirSync(join(root, 'harness/comp'), { recursive: true })
    writeFileSync(join(root, 'harness/comp/index.mjs'), '//\n')
    g('add', '-A'); g('commit', '-q', '-m', 'seed'); g('tag', 'harness-v0.8') // no releases/0.8.json
    writeFileSync(join(root, 'harness/comp/index.mjs'), '// changed\n')
    g('add', '-A'); g('commit', '-q', '-m', 'change')
    const manifest = { components: [{ id: 'comp', path: 'harness/comp/', version: '0.1.0' }] }
    assert.deepEqual(checkVersionBumpOnChange(manifest, root), [])
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

test('runDoctor: unreadable manifest is a single ERROR', () => {
  const { findings } = runDoctor({ root: '/x', manifestPath: '/nope/does-not-exist.json' })
  assert.equal(findings.length, 1)
  assert.equal(findings[0].severity, 'ERROR')
  assert.equal(findings[0].code, 'manifest-unreadable')
})

test('runDoctor: the manifest carries the component census (no fail-open)', () => {
  const { manifest } = runDoctor() // one spine file: rails + components
  assert.ok(manifest && Array.isArray(manifest.components), 'merged shape exposes components')
  assert.ok(manifest.components.length > 0, 'component census present — not an empty/fail-open list')
})

test('runDoctor: the real repo manifest has zero ERRORs (boundary holds)', () => {
  const { findings, manifest } = runDoctor() // defaults to repo manifest + root
  assert.ok(manifest, 'manifest loaded')
  const errors = sev(findings, 'ERROR')
  assert.deepEqual(errors, [], `expected no drift, got: ${JSON.stringify(errors, null, 2)}`)
})
