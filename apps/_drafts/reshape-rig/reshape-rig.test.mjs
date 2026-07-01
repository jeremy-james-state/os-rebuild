/**
 * reshape-rig — the §D2 eval battery as executable tests.
 *
 * RED-FIRST CONVENTION: tests prefixed [P1-target]/[P2-target]/[P3-target]/
 * [P4-target] are EXPECTED to FAIL until that phase of the os-reshape plan
 * lands (they assert the hardened/new behaviour, not today's). A phase-target
 * test failing BEFORE its phase is the designed RED; failing AFTER its phase
 * is a regression. Everything else must be green on every commit.
 *
 * CONSEQUENCE (by design, per the locked merge ruling): this file is matched
 * by the CI merge-gate glob, so the os-reshape branch CANNOT merge while any
 * phase-target is red — the battery IS the gate. Branches cut from main are
 * unaffected (main does not carry this file until the final merge).
 *
 * Hermetic: fault injection runs in repo copies (verbatim symlinks, no live
 * state/); loop runs redirect OS_RECORD_DIR/OS_DB/OS_DROPS; ambient OS_* env
 * never reaches children. Nothing here mutates the live tree.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  REPO, PATHS, abs, runNode, runNodeAsync, hermeticEnv, repoCopy, runCheck,
  evalF1, evalF2, evalF3, evalF4, evalC1, evalC2, evalC3, evalG1, lastRunRow,
} from './rig.mjs'
import { acquire as lockAcquire } from '../../../harness/guard/harness-lock/index.mjs'

const rm = (p) => rmSync(p, { recursive: true, force: true })
const RIG = join(REPO, 'apps/_drafts/reshape-rig')

/**
 * A governance check went EXPLICITLY red: a real positive exit code. Silent
 * no-op (runCheck maps it to -1), timeout (null), or crash-by-signal must
 * NEVER satisfy a fail-closed assertion.
 */
const explicitRed = (c) => Number.isInteger(c.status) && c.status > 0

// ── functionality (green today) ──────────────────────────────────────────────

test('F1: `os:` command → hook BLOCKS with real doctor result', () => {
  const e = evalF1()
  try { assert.ok(e.pass, e.detail) } finally { rm(e.recordDir) }
})

test('F2: natural language → additionalContext with 🔁 trace + OPERATING PROTOCOL', () => {
  const e = evalF2()
  try { assert.ok(e.pass, e.detail) } finally { rm(e.recordDir) }
})

test('F3: statusline renders the 🔁 trace', () => {
  const e = evalF3()
  assert.ok(e.pass, e.detail)
})

test('F4: orchestrator --demo routes to doctor and completes', () => {
  const e = evalF4()
  try { assert.ok(e.pass, e.detail) } finally { rm(e.recordDir) }
})

test('F5: golden master identical (capture.mjs --check)', () => {
  const r = runNode(join(RIG, 'capture.mjs'), { args: ['--check'] })
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
    assert.ok(explicitRed(c), `doctor must go RED on an absent declared component; got status=${c.status}${c.noOutput ? ' (silent no-op)' : ''}\n${c.stdout.slice(0, 400)}`)
    assert.ok(c.errors.includes('declared-but-absent'), `expected declared-but-absent, got ${c.errors}`)
  } finally { rm(copy) }
})

test('G3 [fault-injected]: corrupt governance-ledger line → governance-check exits 1', () => {
  const copy = repoCopy()
  try {
    appendFileSync(join(copy, PATHS.ledger), 'NOT-JSON{\n')
    const c = runCheck(PATHS.governanceCheck, copy)
    assert.ok(explicitRed(c), `governance-check must go RED on a corrupt ledger; got ${c.status}`)
    assert.ok(c.errors.includes('ledger-invalid-json'), `expected ledger-invalid-json, got ${c.errors}`)
  } finally { rm(copy) }
})

test('G5a [fault-injected]: a classifier rule routing to a ghost target → no-ghost-agent exits 1', () => {
  const copy = repoCopy()
  try {
    appendFileSync(join(copy, PATHS.classifierDir, 'index.mjs'),
      "\nRULES.push({ match: /zz-ghost-probe/, type: 'check', confidence: 'high', target: 'zz-ghost-probe' })\n")
    const c = runCheck(PATHS.noGhost, copy)
    assert.ok(explicitRed(c), `no-ghost-agent must go RED on a ghost target; got ${c.status}\n${c.stdout.slice(0, 300)}`)
    assert.ok(c.errors.includes('ghost-agent'), `expected ghost-agent, got ${c.errors}`)
  } finally { rm(copy) }
})

test('G6 [fault-injected]: substantive change without a version bump → doctor exits 1', () => {
  const copy = repoCopy({ withGit: true })
  try {
    // baseline = the HIGHEST release (proper two-part numeric compare — a
    // parseFloat sort ranks 0.9 above 0.14 and picks a stale, eroding pool)
    const rels = readdirSync(join(copy, 'harness/releases')).filter((f) => /^\d+\.\d+\.json$/.test(f))
      .sort((a, b) => {
        const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
        return pa[0] - pb[0] || pa[1] - pb[1]
      })
    const pins = JSON.parse(readFileSync(join(copy, 'harness/releases', rels.at(-1)), 'utf8')).pins || {}
    const census = JSON.parse(readFileSync(join(copy, PATHS.manifest), 'utf8')).components || []
    const target = census.find((c) => c.id in pins && c.version === pins[c.id] && c.path && existsSync(join(copy, c.path, 'index.mjs')))
    assert.ok(target, `no pinned on-disk component found to probe in ${rels.at(-1)} — rig assumption broken`)
    appendFileSync(join(copy, target.path, 'index.mjs'), '\n// rig-probe: substantive change without version bump\n')
    const c = runCheck(PATHS.doctor, copy)
    assert.ok(explicitRed(c), `doctor must go RED on changed-but-unbumped '${target.id}'; got ${c.status}`)
    assert.ok(c.errors.includes('version-bump-required'), `expected version-bump-required, got ${c.errors}`)
  } finally { rm(copy) }
})

test('G7: every CODEOWNERS path pattern matches a real repo path', () => {
  const lines = readFileSync(join(REPO, '.github/CODEOWNERS'), 'utf8').split('\n')
  const patterns = lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/)[0]).filter((p) => p !== '*')
  const missing = patterns.filter((p) => !existsSync(join(REPO, p.replace(/^\//, '').replace(/\/$/, ''))))
  assert.deepEqual(missing, [], `CODEOWNERS patterns pointing at nothing (stale after a move?): ${missing.join(', ')}`)
})

test('G8: ci.yml at root, find-glob intact, discovered test files ≥ committed baseline', () => {
  const ciPath = join(REPO, '.github/workflows/ci.yml')
  assert.ok(existsSync(ciPath), '.github/workflows/ci.yml is GONE — CI silently not running')
  const ci = readFileSync(ciPath, 'utf8')
  const findMatch = ci.match(/find ([a-z. ]+?) -name '\*\.test\.mjs'/)
  assert.ok(findMatch, 'ci.yml no longer discovers tests via the find glob')
  const dirs = findMatch[1].trim().split(/\s+/)
  let found = 0
  const walk = (d) => {
    let entries = []
    try { entries = readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.name === 'node_modules') continue
      if (e.isDirectory()) walk(join(d, e.name))
      else if (e.name.endsWith('.test.mjs')) found += 1
    }
  }
  for (const d of dirs) walk(join(REPO, d))
  const baseline = JSON.parse(readFileSync(join(RIG, 'battery-baseline.json'), 'utf8'))
  assert.ok(found >= baseline.testFiles,
    `CI discovers ${found} test files < baseline ${baseline.testFiles} — tests have silently vanished from the gate`)
})

test('M2: the §D2 coverage table is complete — every eval id has an owner', () => {
  const CANONICAL = ['F1', 'F2', 'F3', 'F4', 'F5', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
    'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9',
    'O1', 'O2', 'O3', 'O4', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8',
    'X1', 'X2', 'X3', 'R1', 'W1', 'W2', 'W3', 'W4', 'W5', 'M1', 'M2', 'NN1', 'NN2']
  const table = JSON.parse(readFileSync(join(RIG, 'coverage.json'), 'utf8')).evals
  const KINDS = new Set(['rig-test', 'component-test', 'script', 'ci', 'procedure'])
  const missing = CANONICAL.filter((id) => !table[id] || !table[id].owner || !KINDS.has(table[id].kind))
  assert.deepEqual(missing, [], `§D2 ids with no executable owner in coverage.json: ${missing.join(', ')}`)
})

test('[P1-target] grep-gate runs green with real patterns (stale-path gate armed + zero hits)', () => {
  // Pre-P1 the pattern list is empty and grep-gate exits 1 by design (a
  // vacuous pass is a silent failure). P1 fills PATTERNS with the move map;
  // from then on this asserts zero stale references — automated, not manual.
  const r = runNode(join(RIG, 'grep-gate.mjs'))
  assert.equal(r.status, 0, `grep-gate not green: ${r.stderr}${r.stdout.slice(0, 600)}`)
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

test('O2: the live record runs stream is complete — gaps=0, dups=0 (absent-tolerant on fresh checkouts)', async () => {
  const { completeness } = await import('../../../harness/loop/loop-store/index.mjs')
  const liveRecord = join(REPO, 'record')
  if (!existsSync(join(liveRecord, 'runs.jsonl'))) {
    // fresh checkout (record/ is gitignored): nothing to audit — assert the
    // shape explicitly rather than silently skipping
    assert.ok(!existsSync(join(liveRecord, 'runs.jsonl')), 'unreachable')
    return
  }
  const c = completeness('runs', liveRecord)
  assert.equal(c.gaps?.length ?? c.gaps ?? 0, 0, `live runs stream has gaps: ${JSON.stringify(c).slice(0, 200)}`)
  assert.equal(c.duplicates?.length ?? c.duplicates ?? 0, 0, `live runs stream has duplicates: ${JSON.stringify(c).slice(0, 200)}`)
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

test('[P1-target] G4 [fault-injected]: rogue top-level dir → structure-check fails EXPLICITLY (fail-closed)', () => {
  const copy = repoCopy()
  try {
    mkdirSync(join(copy, 'zz-rogue-tier'))
    writeFileSync(join(copy, 'zz-rogue-tier', 'rogue.mjs'), 'export const x = 1\n')
    const c = runCheck(PATHS.structureCheck, copy)
    assert.ok(explicitRed(c), `structure-check must fail EXPLICITLY (positive exit) on a rogue top-level dir; got status=${c.status}${c.noOutput ? ' (silent no-op)' : ''} — canonical-shape drift must fail closed`)
  } finally { rm(copy) }
})

test('[P1-target] G5b [fault-injected]: classifier+orchestrator unimportable → no-ghost-agent fails LOUD, not silent-pass', () => {
  const copy = repoCopy()
  try {
    renameSync(join(copy, PATHS.classifierDir), join(copy, PATHS.classifierDir + '.moved'))
    renameSync(join(copy, PATHS.orchestratorDir), join(copy, PATHS.orchestratorDir + '.moved'))
    const c = runCheck(PATHS.noGhost, copy)
    assert.ok(explicitRed(c), `no-ghost-agent must fail EXPLICITLY with ZERO resolvable targets (both imports throw); got status=${c.status}${c.noOutput ? ' (silent no-op)' : ''} — the swallow must become a loud failure`)
  } finally { rm(copy) }
})

// ── sealed-boot self-containment matrix (§C — RED until P2/P3) ──────────────

const publishAbs = join(REPO, PATHS.publish)
const publishExists = () => existsSync(publishAbs)
/** A refusal must be EXPLICIT — a positive exit AND words about the actual problem, never an unknown-flag rejection. */
const refusedProperly = (r, markers) =>
  Number.isInteger(r.status) && r.status > 0 &&
  !/unknown (option|flag|argument)/i.test(r.stdout + r.stderr) &&
  markers.test(r.stdout + r.stderr)

test('[P2-target] S0: the publish CLI exists (.system/bin/os-publish.mjs)', () => {
  assert.ok(publishExists(), `sealed runtime not built yet: ${PATHS.publish} missing (P2 builds it; the S-matrix boots from its snapshots)`)
})

test('[P2-target] S1: isolation boot — snapshot boots with harness/ AND governance/ renamed away', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    let r = runNode(join(copy, PATHS.publish), { cwd: copy })
    assert.equal(r.status, 0, `publish failed in the copy: ${r.stderr.slice(0, 400)}`)
    // the WHOLE workbench source goes away — a snapshot that escapes to the
    // workbench for its doctor (or anything else) must fail here, loudly
    renameSync(join(copy, 'harness'), join(copy, 'harness.moved-away'))
    renameSync(join(copy, 'governance'), join(copy, 'governance.moved-away'))
    const snapshotHook = join(copy, PATHS.currentPointer, 'harness', PATHS.sessionFeedback.replace(/^harness\//, ''))
    r = runNode(snapshotHook, { args: ['--text', 'os: check the harness for drift'], cwd: copy, env })
    let j = null
    try { j = JSON.parse(r.stdout) } catch { /* fall through */ }
    assert.equal(j?.decision, 'block', `sealed boot did not run the enforced path with the source tree gone: status=${r.status} stdout=${r.stdout.slice(0, 300)} stderr=${r.stderr.slice(0, 300)}`)
    assert.match(j?.reason || '', /doctor: \d+ errors/, 'the enforced result must carry a REAL doctor verdict produced from inside the snapshot')
  } finally { rm(copy); rm(dir) }
})

test('[P2-target] S2: missing file inside the snapshot → boot fails LOUD (never silent success)', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    let r = runNode(join(copy, PATHS.publish), { cwd: copy })
    assert.equal(r.status, 0, `publish failed: ${r.stderr.slice(0, 300)}`)
    const inSnap = join(copy, PATHS.currentPointer, 'harness')
    const victim = readdirSync(inSnap, { recursive: true }).find((f) => String(f).endsWith('classifier/index.mjs'))
    assert.ok(victim, 'snapshot layout: classifier/index.mjs not found inside snapshot')
    rm(join(inSnap, String(victim)))
    const snapshotHook = join(copy, PATHS.currentPointer, 'harness', PATHS.sessionFeedback.replace(/^harness\//, ''))
    r = runNode(snapshotHook, { args: ['--text', 'os: check the harness for drift'], cwd: copy, env })
    const silent = r.status === 0 && !/(missing|cannot find|ERR_MODULE_NOT_FOUND|refus|corrupt)/i.test(r.stdout + r.stderr)
    assert.ok(!silent, `boot with a gutted snapshot neither errored nor reported: status=${r.status}`)
  } finally { rm(copy); rm(dir) }
})

test('[P2-target] S3: blank/wrong snapshot version → boot refuses explicitly', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    let r = runNode(join(copy, PATHS.publish), { cwd: copy })
    assert.equal(r.status, 0, `publish failed: ${r.stderr.slice(0, 300)}`)
    const mPath = join(copy, PATHS.currentPointer, 'harness', 'manifest.json')
    const m = JSON.parse(readFileSync(mPath, 'utf8')); m.harnessVersion = ''
    writeFileSync(mPath, JSON.stringify(m, null, 2))
    const boot = runNode(join(copy, PATHS.publish), { args: ['--boot-check'], cwd: copy, env })
    assert.ok(refusedProperly(boot, /version|blank|invalid|mismatch|refus/i),
      `a blank snapshot version must be refused EXPLICITLY (positive exit + a version complaint): status=${boot.status} out=${(boot.stdout + boot.stderr).slice(0, 300)}`)
  } finally { rm(copy); rm(dir) }
})

test('[P2-target] S4: partial snapshot → cut-then-verify REFUSES it explicitly', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  try {
    const torn = join(copy, PATHS.releasesDir, '99.99')
    mkdirSync(torn, { recursive: true })
    writeFileSync(join(torn, 'README.md'), 'torn snapshot: no harness inside\n')
    const r = runNode(join(copy, PATHS.publish), { args: ['--verify', torn], cwd: copy })
    assert.ok(refusedProperly(r, /verif|snapshot|missing|torn|incomplete|invalid|refus/i),
      `cut-then-verify must REFUSE a torn snapshot with an explicit verification failure (not an unknown-flag error): status=${r.status} out=${(r.stdout + r.stderr).slice(0, 300)}`)
  } finally { rm(copy) }
})

test('[P2-target] S5: stale current pointer (target version dir missing) → boot-check refuses loudly', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    let r = runNode(join(copy, PATHS.publish), { cwd: copy })
    assert.equal(r.status, 0, `publish failed: ${r.stderr.slice(0, 300)}`)
    const cur = join(copy, PATHS.currentPointer)
    rm(cur)
    writeFileSync(cur, '99.99\n') // file-backed pointer form; P2 may use symlink — verify handles both
    const boot = runNode(join(copy, PATHS.publish), { args: ['--boot-check'], cwd: copy, env })
    assert.ok(refusedProperly(boot, /stale|missing|not found|pointer|current|refus|invalid/i),
      `boot-check must refuse a stale current pointer explicitly: status=${boot.status} out=${(boot.stdout + boot.stderr).slice(0, 300)}`)
  } finally { rm(copy); rm(dir) }
})

test('[P3-target] S6: channel mismatch — channel=next with no next release → loud refusal', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2/P3)`)
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    let r = runNode(join(copy, PATHS.publish), { cwd: copy })
    assert.equal(r.status, 0, `publish failed: ${r.stderr.slice(0, 300)}`)
    mkdirSync(join(copy, '.system/state'), { recursive: true })
    writeFileSync(join(copy, PATHS.channelFile), 'next\n') // no `next` pointer published
    const boot = runNode(join(copy, PATHS.publish), { args: ['--boot-check'], cwd: copy, env })
    assert.ok(refusedProperly(boot, /channel|next|missing|refus|invalid/i),
      `channel=next with no next release must refuse loudly: status=${boot.status} out=${(boot.stdout + boot.stderr).slice(0, 300)}`)
  } finally { rm(copy); rm(dir) }
})

test('[P2-target] S7: the version stamp survives under snapshot boot', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    let r = runNode(join(copy, PATHS.publish), { cwd: copy })
    assert.equal(r.status, 0, `publish failed: ${r.stderr.slice(0, 300)}`)
    const snapshotHook = join(copy, PATHS.currentPointer, 'harness', PATHS.sessionFeedback.replace(/^harness\//, ''))
    r = runNode(snapshotHook, { args: ['--text', 'os: check the harness for drift'], cwd: copy, env })
    const row = lastRunRow(dir)
    assert.ok(row?.harnessVersion, `a run booted from the snapshot lost its version stamp: ${JSON.stringify(row || {}).slice(0, 200)}`)
  } finally { rm(copy); rm(dir) }
})

test('[P2-target] S8: record/ + state/ live OUTSIDE the snapshot (data-layer externality)', () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2)`)
  const copy = repoCopy()
  const { dir, env } = hermeticEnv()
  try {
    let r = runNode(join(copy, PATHS.publish), { cwd: copy })
    assert.equal(r.status, 0, `publish failed: ${r.stderr.slice(0, 300)}`)
    const snapRoot = join(copy, PATHS.currentPointer)
    for (const banned of ['record', 'state']) {
      assert.ok(!existsSync(join(snapRoot, banned)), `snapshot must NOT contain ${banned}/ — the data layer is written every turn and stays outside the read-only image`)
    }
    // and a snapshot boot writes its rows to the EXTERNAL data layer
    const snapshotHook = join(snapRoot, 'harness', PATHS.sessionFeedback.replace(/^harness\//, ''))
    r = runNode(snapshotHook, { args: ['--text', 'os: check the harness for drift'], cwd: copy, env })
    assert.ok(lastRunRow(dir), 'snapshot boot wrote no run row to the external record dir')
  } finally { rm(copy); rm(dir) }
})

// ── concurrency ──────────────────────────────────────────────────────────────

test('[P3-target] X1: harness-lock wired live as PreToolUse AND a colliding write is functionally blocked (exit 2)', () => {
  const settings = JSON.parse(readFileSync(join(REPO, PATHS.settings), 'utf8'))
  const cmds = (settings.hooks?.PreToolUse || []).flatMap((h) => (h.hooks || []).map((x) => x.command || ''))
  const lockCmd = cmds.find((c) => c.includes('harness-lock'))
  assert.ok(lockCmd, `PreToolUse hooks are [${cmds.join(' | ')}] — harness-lock is not wired (dormant)`)
  // functional leg: the WIRED script must block a write colliding with a live foreign lock
  const script = (lockCmd.match(/"?\$CLAUDE_PROJECT_DIR\/([^"]+)"?/) || [])[1]
  assert.ok(script, `cannot extract the harness-lock script path from the wired command: ${lockCmd}`)
  const t = repoCopy()
  try {
    lockAcquire('classifier', 'someone-else', { root: t })
    const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: join(t, PATHS.classifierDir, 'index.mjs') }, session_id: 'rig-session', cwd: t })
    const r = runNode(join(REPO, script), { input: payload, env: { HARNESS_ROOT: t }, cwd: t })
    assert.equal(r.status, 2, `a write colliding with a live foreign lock must exit 2; got ${r.status} stderr=${r.stderr.slice(0, 200)}`)
  } finally { rm(t) }
})

test('W2: harness-lock blocks a foreign-lock write (the control itself, direct invocation)', () => {
  const t = repoCopy()
  try {
    lockAcquire('classifier', 'someone-else', { root: t })
    const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: join(t, PATHS.classifierDir, 'index.mjs') }, session_id: 'rig-session', cwd: t })
    const r = runNode(join(REPO, 'harness/guard/harness-lock/index.mjs'), { input: payload, env: { HARNESS_ROOT: t }, cwd: t })
    assert.equal(r.status, 2, `harness-lock (direct) must block a live foreign-lock write with exit 2; got ${r.status} stderr=${r.stderr.slice(0, 200)}`)
  } finally { rm(t) }
})

test('X2a: the existing loop-store lock holds at fan-out load — complete, gapless, dup-free', async () => {
  // green-required: loop-store's O_EXCL lock already serialises n-assignment
  // at this load (verified empirically at P0). The P3 target is X2b below —
  // the live-holder steal path — NOT this.
  const { dir } = hermeticEnv()
  const writer = join(RIG, 'x-writer.mjs')
  const WRITERS = 6, EACH = 40
  try {
    const results = await Promise.all(Array.from({ length: WRITERS }, (_, i) => runNodeAsync(writer, { args: [dir, String(EACH), `w${i}`] })))
    assert.ok(results.every((r) => r.status === 0), `writer crashed: ${JSON.stringify(results.map((r) => r.status))}`)
    const rows = readFileSync(join(dir, 'runs.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    const drops = existsSync(join(dir, 'drops.jsonl')) ? readFileSync(join(dir, 'drops.jsonl'), 'utf8').trim().split('\n').filter(Boolean) : []
    const markers = new Set(rows.filter((r) => r.kind === 'x2-probe').map((r) => `${r.label}:${r.i}`))
    const total = WRITERS * EACH
    const ns = rows.map((r) => r.n).sort((a, b) => a - b)
    const dups = ns.filter((n, i) => i && n === ns[i - 1]).length
    assert.equal(markers.size + drops.length, total, `silent loss: ${total} written, ${markers.size} stored + ${drops.length} recorded drops`)
    assert.equal(dups, 0, `${dups} duplicate indices — two writers were handed the same n`)
  } finally { rm(dir) }
})

test('[P3-target] X2b: a lock held by a LIVE holder is never stolen — wait, or record a drop loudly', async () => {
  // Today withLock force-breaks ANY lock after ~1s of spinning, alive holder
  // or not (loop-store/index.mjs withLock) → two writers in the critical
  // section → stale n → silent duplicate. P3's fix: never steal from a live
  // holder (wait), and if a write is abandoned, record it loudly in drops.
  const { dir } = hermeticEnv()
  const HOLD_MS = 3000
  try {
    const lockerP = runNodeAsync(join(RIG, 'x-locker.mjs'), { args: [dir, String(HOLD_MS)] })
    await new Promise((r) => setTimeout(r, 300)) // locker is holding
    const writerP = runNodeAsync(join(RIG, 'x-writer.mjs'), { args: [dir, '5', 'thief'] }).then((r) => ({ ...r, endedAt: Date.now() }))
    const [locker, writer] = await Promise.all([lockerP, writerP])
    assert.equal(locker.status, 0, `locker crashed: ${locker.stderr.slice(0, 200)}`)
    assert.equal(writer.status, 0, `writer crashed: ${writer.stderr.slice(0, 200)}`)
    const { releasedAt } = JSON.parse(locker.stdout)
    const drops = existsSync(join(dir, 'drops.jsonl')) ? readFileSync(join(dir, 'drops.jsonl'), 'utf8').trim().split('\n').filter(Boolean) : []
    const stole = writer.endedAt < releasedAt && drops.length === 0
    assert.ok(!stole,
      `the writer finished ${releasedAt - writer.endedAt}ms BEFORE the live holder released and recorded no drop — it silently stole the lock (the P3 lock-steal fix target)`)
  } finally { rm(dir) }
})

test('[P3-target] X3: two concurrent publishes → the current pointer is INTACT (boot-check green, no escape hatch)', async () => {
  assert.ok(publishExists(), `${PATHS.publish} missing (P2/P3)`)
  const copy = repoCopy()
  try {
    const [a, b] = await Promise.all([
      runNodeAsync(join(copy, PATHS.publish), { cwd: copy }),
      runNodeAsync(join(copy, PATHS.publish), { cwd: copy }),
    ])
    // whatever the two publishes did, the pointer must be bootable afterwards —
    // no disjunctive escape: a torn pointer fails this regardless of lock chatter
    const verify = runNode(join(copy, PATHS.publish), { args: ['--boot-check'], cwd: copy })
    assert.equal(verify.status, 0, `after two concurrent publishes (a=${a.status}${a.killed ? '/killed' : ''}, b=${b.status}${b.killed ? '/killed' : ''}) boot-check failed — the current pointer is torn: ${(verify.stdout + verify.stderr).slice(0, 300)}`)
  } finally { rm(copy) }
})

// ── lockdown battery scaffolds (RED until P4) ────────────────────────────────

test('[P4-target] W1: an out-of-repo write is BLOCKED under lockdown (fail-closed allowlist)', () => {
  // Today the live confinement tier is decide() — fail-open blocklist that only
  // stops ~/Projects siblings; a write to any other outside path sails through.
  // P4 flips main() to decideStrict (fail-closed allowlist): everything outside
  // the repo is blocked. This is THE lockdown behaviour, asserted end-to-end.
  const outside = join(process.env.TMPDIR || '/tmp', 'rig-w1-outside-probe.txt')
  const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: outside }, cwd: REPO })
  const r = runNode(abs(PATHS.confinement), { input: payload })
  assert.equal(r.status, 2, `under lockdown a Write outside the repo must be BLOCKED (exit 2); got ${r.status} — the live tier is still the fail-open blocklist`)
})

test('[P4-target] W4: the adopted state boots from the sealed snapshot, not the workbench', () => {
  const settings = JSON.parse(readFileSync(join(REPO, PATHS.settings), 'utf8'))
  const cmds = [
    settings.statusLine?.command || '',
    ...(settings.hooks?.UserPromptSubmit || []).flatMap((h) => (h.hooks || []).map((x) => x.command || '')),
  ]
  const sealed = cmds.filter((c) => c.includes('.system/')).length
  assert.ok(sealed >= 2, `adoption not flipped: statusLine + UserPromptSubmit must boot via the sealed launcher/.system path; commands = [${cmds.join(' | ')}]`)
})
