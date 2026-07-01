import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { append, read } from '../loop-store/index.mjs'
import { sweep, gitDrift } from './index.mjs'

function tmp() { return mkdtempSync(join(tmpdir(), 'recon-')) }
const fixedNow = () => '2026-07-01T00:00:00.000Z'
function ids() { let k = 0; return () => `rid-${k++}` }
// isolate the drops file per test so the global state/ file never leaks in
const opt = (dir) => ({ dir, dropsPath: join(dir, 'drops.jsonl'), now: fixedNow, idGen: ids() })

test('raises an incident for a signal that never reached an outcome (limbo)', () => {
  const dir = tmp()
  try {
    append('signals', { summary: 'covered' }, { dir, now: fixedNow })   // signals:1
    append('signals', { summary: 'limbo!' }, { dir, now: fixedNow })    // signals:2 — no run
    append('runs', { signal: 'signals:1', status: 'completed' }, { dir, now: fixedNow })
    const r = sweep(opt(dir))
    assert.deepEqual(r.limbo, ['signals:2'])
    assert.equal(r.raised.length, 1)
    const inc = read('incidents', dir).records[0]
    assert.equal(inc.signal, 'signals:2')
    assert.equal(inc.status, 'open')
    assert.equal(inc.cause, 'limbo')
    assert.match(inc.reason, /limbo/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('idempotent: a second sweep raises nothing new', () => {
  const dir = tmp()
  try {
    append('signals', { summary: 'limbo' }, { dir, now: fixedNow })
    const first = sweep(opt(dir))
    assert.equal(first.raised.length, 1)
    const second = sweep(opt(dir))
    assert.equal(second.raised.length, 0)
    assert.equal(read('incidents', dir).records.length, 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a signal with ANY terminal run (even unknown) is not limbo', () => {
  const dir = tmp()
  try {
    append('signals', { summary: 'x' }, { dir, now: fixedNow })
    append('runs', { signal: 'signals:1', status: 'unknown' }, { dir, now: fixedNow })
    const r = sweep(opt(dir))
    assert.deepEqual(r.limbo, [])
    assert.equal(r.raised.length, 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('clean data layer → nothing raised', () => {
  const dir = tmp()
  try {
    const r = sweep(opt(dir))
    assert.deepEqual(r, { checked: 0, limbo: [], drift: [], raised: [] })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('raises for a capture whose signals-stream write was DROPPED (authoritative over drops)', () => {
  const dir = tmp()
  try {
    // simulate a drop marker as loop-store would write it for a failed signals append
    writeFileSync(join(dir, 'drops.jsonl'),
      JSON.stringify({ ts: '2026-07-01T00:00:00.000Z', stage: 'append', stream: 'signals', n: 1, reason: 'EIO', record: { id: 'signals:1' } }) + '\n')
    const r = sweep(opt(dir))
    assert.deepEqual(r.limbo, ['signals:1'])
    assert.equal(r.raised.length, 1)
    const inc = read('incidents', dir).records[0]
    assert.equal(inc.cause, 'dropped-write')
    // idempotent across sweeps
    assert.equal(sweep(opt(dir)).raised.length, 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// ── gitDrift (unit — injected `git`, tmp roots; NEVER the live repo) ─────────────

// A fake git runner from a canned map of "joined-args" → output. Any un-mapped command → ''.
function fakeGit(map = {}) { return (args) => map[args.join(' ')] ?? '' }
// Build a tmp root with a harness/ layout: a manifest at `hv` and pin files for `releases`.
function tmpRoot({ hv = null, releases = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'recon-root-'))
  mkdirSync(join(root, 'harness/releases'), { recursive: true })
  if (hv) writeFileSync(join(root, 'harness/manifest.json'), JSON.stringify({ harnessVersion: hv }))
  for (const v of releases) writeFileSync(join(root, `harness/releases/${v}.json`), JSON.stringify({ harnessVersion: v }))
  return root
}

test('gitDrift: unpushed-commits fires when rev-list returns commits', () => {
  const git = fakeGit({ 'rev-list @{upstream}..HEAD': 'abc123\ndef456\n' })
  const d = gitDrift({ root: tmpRoot(), git })
  const hit = d.find((x) => x.kind === 'unpushed-commits')
  assert.ok(hit, 'unpushed-commits should fire')
  assert.match(hit.message, /2 local commit/)
})

test('gitDrift: fails OPEN — an injected git that THROWS yields no drift and does not throw', () => {
  const throwingGit = () => { throw new Error('not a git repo') }
  let d
  assert.doesNotThrow(() => { d = gitDrift({ root: tmpRoot(), git: throwingGit }) })
  assert.deepEqual(d, [])
})

test('gitDrift: fails OPEN — git returning "" (no upstream / no tags) yields no drift', () => {
  const d = gitDrift({ root: tmpRoot({ hv: '0.8', releases: ['0.8'] }), git: fakeGit({}) })
  // rev-list '' → no unpushed; but a pinned release with an empty tag list IS release-untagged.
  assert.equal(d.some((x) => x.kind === 'unpushed-commits'), false)
})

test('gitDrift: release-untagged fires when a release file exists but the tag list lacks it', () => {
  const root = tmpRoot({ hv: '0.8', releases: ['0.8'] })
  const git = fakeGit({ 'tag --list': 'harness-v0.7\nv0.6\n' }) // no 0.8 tag
  const d = gitDrift({ root, git })
  const hit = d.find((x) => x.kind === 'release-untagged')
  assert.ok(hit, 'release-untagged should fire')
  assert.match(hit.message, /0\.8/)
  rmSync(root, { recursive: true, force: true })
})

test('gitDrift: release-untagged does NOT fire when a matching tag is present', () => {
  const root = tmpRoot({ hv: '0.8', releases: ['0.8'] })
  const git = fakeGit({ 'tag --list': 'harness-v0.8\n' })
  const d = gitDrift({ root, git })
  assert.equal(d.some((x) => x.kind === 'release-untagged'), false)
  rmSync(root, { recursive: true, force: true })
})

test('gitDrift: no release file → release-untagged does NOT fire (fail-open)', () => {
  const root = tmpRoot({ hv: '0.9', releases: [] }) // manifest says 0.9 but no pin file
  const d = gitDrift({ root, git: fakeGit({ 'tag --list': '' }) })
  assert.equal(d.some((x) => x.kind === 'release-untagged'), false)
  rmSync(root, { recursive: true, force: true })
})

test('gitDrift: version-tag-release-divergence fires on a clear manifest/release disagreement', () => {
  // manifest=0.8, newest release pin=0.9 → clear disagreement.
  const root = tmpRoot({ hv: '0.8', releases: ['0.8', '0.9'] })
  const git = fakeGit({ 'tag --list': 'harness-v0.9\n' }) // tag agrees with the pin, not the manifest
  const d = gitDrift({ root, git })
  const hit = d.find((x) => x.kind === 'version-tag-release-divergence')
  assert.ok(hit, 'divergence should fire')
  rmSync(root, { recursive: true, force: true })
})

test('gitDrift: no divergence when manifest, newest release, and tag all agree', () => {
  const root = tmpRoot({ hv: '0.8', releases: ['0.8'] })
  const git = fakeGit({ 'tag --list': 'harness-v0.8\n' })
  const d = gitDrift({ root, git })
  assert.equal(d.some((x) => x.kind === 'version-tag-release-divergence'), false)
  rmSync(root, { recursive: true, force: true })
})

// ── sweep() integration with git-drift (injected git + tmp root; incidents → tmp dir) ──

test('sweep: raises a git-drift incident (unpushed) through the existing incident path', () => {
  const dir = tmp()
  const root = tmpRoot()
  try {
    const git = fakeGit({ 'rev-list @{upstream}..HEAD': 'c1\n' })
    const r = sweep({ ...opt(dir), root, git })
    assert.deepEqual(r.drift, ['unpushed-commits'])
    assert.equal(r.raised.length, 1)
    const inc = read('incidents', dir).records[0]
    assert.equal(inc.cause, 'git-drift')
    assert.equal(inc.signal, 'unpushed-commits')
    assert.equal(inc.status, 'open')
    assert.equal(inc.kind, 'incident')
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }) }
})

test('sweep: git-drift is idempotent by kind — a second sweep raises nothing new', () => {
  const dir = tmp()
  const root = tmpRoot()
  try {
    const git = fakeGit({ 'rev-list @{upstream}..HEAD': 'c1\n' })
    assert.equal(sweep({ ...opt(dir), root, git }).raised.length, 1)
    assert.equal(sweep({ ...opt(dir), root, git }).raised.length, 0)
    assert.equal(read('incidents', dir).records.length, 1)
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }) }
})

test('sweep: git-drift step is INERT in tmp mode when neither root nor git is provided', () => {
  const dir = tmp()
  try {
    // opt(dir) sets dir but NOT root/git → drift detection must not run against the live repo.
    const r = sweep(opt(dir))
    assert.deepEqual(r.drift, [])
    assert.equal(r.raised.length, 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('sweep: a throwing injected git cannot crash the sweep (fail-open backstop)', () => {
  const dir = tmp()
  const root = tmpRoot()
  try {
    const boom = () => { throw new Error('git exploded') }
    let r
    assert.doesNotThrow(() => { r = sweep({ ...opt(dir), root, git: boom }) })
    assert.deepEqual(r.drift, [])
    assert.equal(r.raised.length, 0)
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }) }
})
