/**
 * reshape-rig — the §D2 eval battery as executable tests.
 *
 * RED-FIRST CONVENTION: tests prefixed [P1-target]/[P2-target]/[P3-target] are
 * EXPECTED to FAIL until that phase of the os-reshape plan lands (they assert
 * the hardened/new behaviour, not today's). A phase-target test failing BEFORE
 * its phase is the designed RED; failing AFTER its phase is a regression.
 * Everything else must be green on every commit.
 *
 * Hermetic: fault injection runs in repo copies; loop runs redirect
 * OS_RECORD_DIR/OS_DB/OS_DROPS. Nothing here mutates the live tree.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  REPO, PATHS, abs, runNode, runNodeAsync, hermeticEnv, repoCopy, runCheck,
  evalF1, evalF2, evalF3, evalF4, evalC1, evalC2, evalC3, evalG1, lastRunRow,
} from './rig.mjs'

const rm = (p) => rmSync(p, { recursive: true, force: true })

// ── functionality (green today) ──────────────────────────────────────────────

test('F1: `os:` command → hook BLOCKS with real doctor result', () => {
  const e = evalF1()
  try { assert.ok(e.pass, e.detail) } finally { rm(e.recordDir) }
})

test('F2: natural language → additionalContext with 🔁 trace + OPERATING PROTOCOL', () => {
  const e = evalF2()
  assert.ok(e.pass, e.detail)
})

test('F3: statusline renders the 🔁 trace', () => {
  const e = evalF3()
  assert.ok(e.pass, e.detail)
})

test('F4: orchestrator --demo routes to doctor and completes', () => {
  const e = evalF4()
  assert.ok(e.pass, e.detail)
})

test('F5: golden master identical (capture.mjs --check)', () => {
  const r = runNode(join(REPO, 'harness/sandbox/reshape-rig/capture.mjs'), { args: ['--check'] })
  assert.equal(r.status, 0, `golden-master divergence:\n${r.stderr}${r.stdout}`)
})

// ── capability (green today) ─────────────────────────────────────────────────

test('C1: confinement blocks a sibling-project read (exit 2)', () => {
  const e = evalC1(); assert.ok(e.pass, e.detail)
})
test('C2: confinement allows an in-repo read (exit 0)', () => {
  const e = evalC2(); assert.ok(e.pass, e.detail)
})
test('C3: doctor ×5 — deterministic, all exit 0, each within budget', () => {
  const e = evalC3(); assert.ok(e.pass, e.detail)
})

// ── governance: clean pass + fault injection (green today = the rig works) ──

test('G1: all four checks exit 0 on the live tree', () => {
  const e = evalG1(); assert.ok(e.pass, e.detail)
})

test('G2 [fault-injected]: deleting a declared candidate dir → doctor exits 1 (declared-but-absent)', () => {
  const copy = repoCopy()
  try {
    rm(join(copy, PATHS.classifierDir))
    const c = runCheck(PATHS.doctor, copy)
    assert.equal(c.status, 1, `doctor must go RED on an absent declared component; got ${c.status}\n${c.stdout.slice(0, 400)}`)
    assert.ok(c.errors.includes('declared-but-absent'), `expected declared-but-absent, got ${c.errors}`)
  } finally { rm(copy) }
})

test('G3 [fault-injected]: corrupt governance-ledger line → governance-check exits 1', () => {
  const copy = repoCopy()
  try {
    appendFileSync(join(copy, PATHS.ledger), 'NOT-JSON{\n')
    const c = runCheck(PATHS.governanceCheck, copy)
    assert.equal(c.status, 1, `governance-check must go RED on a corrupt ledger; got ${c.status}`)
    assert.ok(c.errors.includes('ledger-invalid-json'), `expected ledger-invalid-json, got ${c.errors}`)
  } finally { rm(copy) }
})

test('G5a [fault-injected]: a classifier rule routing to a ghost target → no-ghost-agent exits 1', () => {
  const copy = repoCopy()
  try {
    appendFileSync(join(copy, PATHS.classifierDir, 'index.mjs'),
      "\nRULES.push({ match: /zz-ghost-probe/, type: 'check', confidence: 'high', target: 'zz-ghost-probe' })\n")
    const c = runCheck(PATHS.noGhost, copy)
    assert.equal(c.status, 1, `no-ghost-agent must go RED on a ghost target; got ${c.status}\n${c.stdout.slice(0, 300)}`)
    assert.ok(c.errors.includes('ghost-agent'), `expected ghost-agent, got ${c.errors}`)
  } finally { rm(copy) }
})

test('G6 [fault-injected]: substantive change without a version bump → doctor exits 1', () => {
  const copy = repoCopy({ withGit: true })
  try {
    // pick a pinned, on-disk component from the latest release
    const rels = readdirSync(join(copy, 'harness/releases')).filter((f) => /^\d+\.\d+\.json$/.test(f))
      .sort((a, b) => parseFloat(a) - parseFloat(b))
    const pins = JSON.parse(readFileSync(join(copy, 'harness/releases', rels.at(-1)), 'utf8')).pins || {}
    const registry = JSON.parse(readFileSync(join(copy, PATHS.registry), 'utf8')).components || []
    const target = registry.find((c) => c.id in pins && c.version === pins[c.id] && c.path && existsSync(join(copy, c.path, 'index.mjs')))
    assert.ok(target, 'no pinned on-disk component found to probe — rig assumption broken')
    appendFileSync(join(copy, target.path, 'index.mjs'), '\n// rig-probe: substantive change without version bump\n')
    const c = runCheck(PATHS.doctor, copy)
    assert.equal(c.status, 1, `doctor must go RED on changed-but-unbumped '${target.id}'; got ${c.status}`)
    assert.ok(c.errors.includes('version-bump-required'), `expected version-bump-required, got ${c.errors}`)
  } finally { rm(copy) }
})

// ── observability ────────────────────────────────────────────────────────────

test('O1a: a routed run row carries traceId, spanId, harnessVersion', () => {
  const e = evalF1()
  try {
    assert.ok(e.pass, e.detail)
    const row = lastRunRow(e.recordDir)
    assert.ok(row, 'no runs row written to the redirected record dir')
    for (const k of ['traceId', 'spanId', 'harnessVersion']) assert.ok(row[k], `runs row missing ${k}: ${JSON.stringify(row).slice(0, 300)}`)
  } finally { rm(e.recordDir) }
})

test('[P1-target] O1b: a routed run row carries a non-null componentVersion', () => {
  const e = evalF1()
  try {
    const row = lastRunRow(e.recordDir)
    assert.ok(row?.componentVersion, `componentVersion missing/null — tracer fail-opened: ${JSON.stringify(row || {}).slice(0, 300)}`)
  } finally { rm(e.recordDir) }
})

test('[P1-target] O1c [fault-injected]: broken manifest → the loop fails LOUD, not a silent null stamp', () => {
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    writeFileSync(join(copy, PATHS.manifest), '{ BROKEN JSON')
    const r = runNode(abs(PATHS.sessionFeedback, copy), { args: ['--text', 'os: check the harness for drift'], cwd: copy, env })
    const row = lastRunRow(dir)
    const loud = r.status !== 0 || /manifest|version/i.test(r.stderr)
    const stamped = !!(row && row.harnessVersion)
    assert.ok(loud || stamped,
      `with a broken manifest the loop neither failed loud (status=${r.status}, stderr=${r.stderr.slice(0, 120)}) nor stamped a version (row=${JSON.stringify(row || {}).slice(0, 200)}) — silent fail-open`)
  } finally { rm(copy); rm(dir) }
})

test('[P2-target] C6 [fault-injected]: doctor.mjs missing → the doctor handler fails LOUD, never a fabricated clean bill', () => {
  // Today (survey-verified): orchestrator L43 spawns the doctor by literal path;
  // a missing doctor yields empty stdout → findings:[] → ok:true, "harness not
  // in drift" — a completed outcome with a FABRICATED clean result. The P2
  // boot-root resolver + fail-loud handler kill this.
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    rm(join(copy, PATHS.doctor))
    const r = runNode(abs(PATHS.orchestrator, copy), { args: ['--demo', 'check', 'the', 'harness', 'for', 'drift'], cwd: copy, env })
    const fabricated = r.stdout.includes('outcome: completed') && !/(missing|cannot|not found|fail)/i.test(r.stdout + r.stderr)
    assert.ok(!fabricated, `doctor.mjs deleted, yet the loop reported a completed doctor outcome with no complaint:\n${r.stdout.slice(-400)}`)
  } finally { rm(copy); rm(dir) }
})

// ── hardening targets (RED until P1) ─────────────────────────────────────────

test('[P1-target] G4 [fault-injected]: rogue top-level dir → structure-check exits NON-ZERO (fail-closed)', () => {
  const copy = repoCopy()
  try {
    mkdirSync(join(copy, 'zz-rogue-tier'))
    writeFileSync(join(copy, 'zz-rogue-tier', 'rogue.mjs'), 'export const x = 1\n')
    const c = runCheck(PATHS.structureCheck, copy)
    assert.notEqual(c.status, 0, 'structure-check passed (exit 0) with a rogue top-level dir — canonical-shape drift must fail closed')
  } finally { rm(copy) }
})

test('[P1-target] G5b [fault-injected]: classifier+orchestrator unimportable → no-ghost-agent fails LOUD, not silent-pass', () => {
  const copy = repoCopy()
  try {
    renameSync(join(copy, PATHS.classifierDir), join(copy, PATHS.classifierDir + '.moved'))
    renameSync(join(copy, PATHS.orchestratorDir), join(copy, PATHS.orchestratorDir + '.moved'))
    const c = runCheck(PATHS.noGhost, copy)
    assert.notEqual(c.status, 0, 'no-ghost-agent exited 0 with ZERO resolvable targets (both imports throw) — the swallow must become a loud failure')
  } finally { rm(copy) }
})

// ── sealed-boot self-containment matrix (§C — RED until P2) ─────────────────

const publishAbs = join(REPO, PATHS.publish)
const publishExists = () => existsSync(publishAbs)

test('[P2-target] S0: the publish CLI exists (.system/bin/os-publish.mjs)', () => {
  assert.ok(publishExists(), `sealed runtime not built yet: ${PATHS.publish} missing (P2 builds it; the S-matrix boots from its snapshots)`)
})

test('[P2-target] S1: isolation boot — snapshot boots with the workbench renamed away', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    let r = runNode(join(copy, PATHS.publish), { cwd: copy })
    assert.equal(r.status, 0, `publish failed in the copy: ${r.stderr.slice(0, 400)}`)
    renameSync(join(copy, 'harness'), join(copy, 'harness.moved-away'))
    const snapshotHook = join(copy, PATHS.currentPointer, 'harness', PATHS.sessionFeedback.replace(/^harness\//, ''))
    r = runNode(snapshotHook, { args: ['--text', 'os: check the harness for drift'], cwd: copy, env })
    const j = JSON.parse(r.stdout || '{}')
    assert.equal(j.decision, 'block', `sealed boot did not run the enforced path with the source tree gone: status=${r.status} stdout=${r.stdout.slice(0, 300)} stderr=${r.stderr.slice(0, 300)}`)
  } finally { rm(copy); rm(dir) }
})

test('[P2-target] S2: missing file inside the snapshot → boot fails LOUD (never silent success)', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    let r = runNode(join(copy, PATHS.publish), { cwd: copy })
    assert.equal(r.status, 0, `publish failed: ${r.stderr.slice(0, 300)}`)
    // remove the classifier from inside the snapshot
    const inSnap = join(copy, PATHS.currentPointer, 'harness')
    const victim = readdirSync(inSnap, { recursive: true }).find((f) => String(f).endsWith('classifier/index.mjs'))
    assert.ok(victim, 'snapshot layout: classifier/index.mjs not found inside snapshot')
    rm(join(inSnap, String(victim)))
    const snapshotHook = join(copy, PATHS.currentPointer, 'harness', PATHS.sessionFeedback.replace(/^harness\//, ''))
    r = runNode(snapshotHook, { args: ['--text', 'os: check the harness for drift'], cwd: copy, env })
    const silent = r.status === 0 && !/(missing|cannot find|ERR_MODULE_NOT_FOUND|refus)/i.test(r.stdout + r.stderr)
    assert.ok(!silent, `boot with a gutted snapshot neither errored nor reported: status=${r.status}`)
  } finally { rm(copy); rm(dir) }
})

test('[P2-target] S3: blank/wrong snapshot version → boot refuses', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    let r = runNode(join(copy, PATHS.publish), { cwd: copy })
    assert.equal(r.status, 0, `publish failed: ${r.stderr.slice(0, 300)}`)
    // blank the version pin inside the snapshot's manifest
    const mPath = join(copy, PATHS.currentPointer, 'harness', 'manifest.json')
    const m = JSON.parse(readFileSync(mPath, 'utf8')); m.harnessVersion = ''
    writeFileSync(mPath, JSON.stringify(m, null, 2))
    const snapshotHook = join(copy, PATHS.currentPointer, 'harness', PATHS.sessionFeedback.replace(/^harness\//, ''))
    r = runNode(snapshotHook, { args: ['--text', 'os: check the harness for drift'], cwd: copy, env })
    assert.ok(r.status !== 0 || /version|refus/i.test(r.stderr + r.stdout), 'a blank snapshot version was booted without complaint')
  } finally { rm(copy); rm(dir) }
})

test('[P2-target] S4: partial snapshot → cut-then-verify REFUSES to repoint current', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  try {
    // hand-build a torn snapshot dir and ask publish --verify to accept it
    const torn = join(copy, PATHS.releasesDir, '99.99')
    mkdirSync(torn, { recursive: true })
    writeFileSync(join(torn, 'README.md'), 'torn snapshot: no harness inside\n')
    const r = runNode(join(copy, PATHS.publish), { args: ['--verify', torn], cwd: copy })
    assert.notEqual(r.status, 0, 'cut-then-verify accepted a torn snapshot')
  } finally { rm(copy) }
})

test('[P2-target] S5: stale current pointer (target version dir missing) → boot refuses loudly', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    let r = runNode(join(copy, PATHS.publish), { cwd: copy })
    assert.equal(r.status, 0, `publish failed: ${r.stderr.slice(0, 300)}`)
    // break the pointer: current → a version dir that does not exist
    const cur = join(copy, PATHS.currentPointer)
    rm(cur)
    writeFileSync(cur, '99.99\n') // file-backed pointer form; P2 may use symlink — verify handles both
    const boot = runNode(join(copy, PATHS.publish), { args: ['--boot-check'], cwd: copy, env })
    assert.notEqual(boot.status, 0, 'boot-check accepted a stale current pointer')
  } finally { rm(copy); rm(dir) }
})

// ── concurrency (RED until P3) ───────────────────────────────────────────────

test('[P3-target] X1: harness-lock is wired live as a PreToolUse hook', () => {
  const settings = JSON.parse(readFileSync(join(REPO, PATHS.settings), 'utf8'))
  const cmds = (settings.hooks?.PreToolUse || []).flatMap((h) => (h.hooks || []).map((x) => x.command || ''))
  assert.ok(cmds.some((c) => c.includes('harness-lock')), `PreToolUse hooks are [${cmds.join(' | ')}] — harness-lock is not wired (dormant)`)
})

test('[P3-target] X2: concurrent writers lose NOTHING silently (complete, gapless, dup-free or loud drops)', async () => {
  const { dir } = hermeticEnv()
  const writer = join(REPO, 'harness/sandbox/reshape-rig/x-writer.mjs')
  const WRITERS = 6, EACH = 40
  try {
    const results = await Promise.all(Array.from({ length: WRITERS }, (_, i) => runNodeAsync(writer, { args: [dir, String(EACH), `w${i}`] })))
    assert.ok(results.every((r) => r.status === 0), `writer crashed: ${JSON.stringify(results.map((r) => r.status))}`)
    const rows = readFileSync(join(dir, 'runs.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    const drops = existsSync(join(dir, 'drops.jsonl')) ? readFileSync(join(dir, 'drops.jsonl'), 'utf8').trim().split('\n').filter(Boolean) : []
    const markers = new Set(rows.filter((r) => r.kind === 'x2-probe').map((r) => `${r.label}:${r.i}`))
    const total = WRITERS * EACH
    const accounted = markers.size + drops.length
    const ns = rows.map((r) => r.n).sort((a, b) => a - b)
    const dups = ns.filter((n, i) => i && n === ns[i - 1]).length
    assert.equal(accounted, total, `silent loss: ${total} written, ${markers.size} stored + ${drops.length} recorded drops = ${accounted}`)
    assert.equal(dups, 0, `${dups} duplicate indices — two writers were handed the same n`)
  } finally { rm(dir) }
})

test('[P3-target] X3: two concurrent publishes serialize — no torn current pointer', async () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2/P3)`)
  const copy = repoCopy()
  try {
    const [a, b] = await Promise.all([
      runNodeAsync(join(copy, PATHS.publish), { cwd: copy }),
      runNodeAsync(join(copy, PATHS.publish), { cwd: copy }),
    ])
    const oneBlocked = (a.status === 0) !== (b.status === 0) || /lock/i.test(a.stderr + b.stderr)
    const verify = runNode(join(copy, PATHS.publish), { args: ['--boot-check'], cwd: copy })
    assert.ok(oneBlocked || verify.status === 0, `concurrent publishes: a=${a.status} b=${b.status}, boot-check=${verify.status} — pointer may be torn`)
  } finally { rm(copy) }
})
