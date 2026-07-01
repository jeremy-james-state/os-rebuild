#!/usr/bin/env node
/**
 * reshape-rig/rig.mjs — CANDIDATE (harness/sandbox/), not admitted.
 *
 * Shared helpers + the §D2 deterministic eval catalogue for the os-reshape
 * execution plan (docs/superpowers/specs/2026-07-01-os-reshape-execution-plan.md).
 *
 * Hermeticity contract:
 *   - Loop runs never touch the live record: OS_RECORD_DIR / OS_DB / OS_DROPS
 *     are redirected to a mkdtemp dir (hermeticEnv()).
 *   - Fault injection never touches the live repo: it runs inside a full repo
 *     copy (repoCopy()), spawning the COPY's own entry points so root
 *     derivation resolves inside the copy.
 *
 * PATHS is the single phase-current path table (§D2 "<x>"): P1 updates it in
 * ONE place when files move, and every eval follows.
 */
import { spawnSync, spawn } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, existsSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = resolve(HERE, '..', '..', '..')

/** Phase-current paths (repo-relative). P1/P2/P3 update these as files move. */
export const PATHS = {
  sessionFeedback: 'harness/sandbox/session-feedback/index.mjs',
  statusline: 'harness/sandbox/session-feedback/statusline.mjs',
  orchestrator: 'harness/sandbox/orchestrator/index.mjs',
  confinement: 'harness/sandbox/confinement/index.mjs',
  classifierDir: 'harness/sandbox/classifier',
  orchestratorDir: 'harness/sandbox/orchestrator',
  loopStore: 'harness/sandbox/loop-store/index.mjs',
  doctor: 'governance/enforcement/doctor.mjs',
  governanceCheck: 'governance/enforcement/governance-check.mjs',
  structureCheck: 'governance/enforcement/structure-check.mjs',
  noGhost: 'governance/enforcement/no-ghost-agent.mjs',
  manifest: 'harness/manifest.json',
  registry: 'harness/registry.json',
  settings: '.claude/settings.json',
  ledger: 'record/governance-ledger.jsonl',
  // P2 contract (test-first): the sealed-runtime surface P2 must build.
  // The S-matrix + X3 drive these paths; they are RED until P2/P3 exist.
  publish: '.system/bin/os-publish.mjs',
  releasesDir: '.system/releases',
  currentPointer: '.system/releases/current',
  channelFile: '.system/state/channel',
}

export const abs = (rel, root = REPO) => join(root, rel)

// ── process helpers ──────────────────────────────────────────────────────────

/** Spawn a node script synchronously; never throws — returns {status, stdout, stderr, signal}. */
export function runNode(script, { args = [], cwd = REPO, input, env = {}, timeout = 180000 } = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd, input, encoding: 'utf8', timeout, env: { ...process.env, ...env },
  })
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', signal: r.signal }
}

/** Spawn a node script asynchronously (for concurrency rigs). Resolves {status, stdout, stderr}. */
export function runNodeAsync(script, { args = [], cwd = REPO, env = {} } = {}) {
  return new Promise((resolvep) => {
    const c = spawn(process.execPath, [script, ...args], { cwd, env: { ...process.env, ...env } })
    let stdout = '', stderr = ''
    c.stdout.on('data', (d) => { stdout += d })
    c.stderr.on('data', (d) => { stderr += d })
    c.on('close', (status) => resolvep({ status, stdout, stderr }))
  })
}

/** Redirect all loop-store writes to a fresh temp dir. Caller rms the dir. */
export function hermeticEnv() {
  // realpath: macOS tmpdir() is a symlink (/var → /private/var); a spawned
  // script whose `import.meta.url === file://argv[1]` main-guard compares the
  // two forms would silently no-op. Everything the rig spawns gets real paths.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'rig-rec-')))
  return {
    dir,
    env: { OS_RECORD_DIR: dir, OS_DB: join(dir, 'os.db'), OS_DROPS: join(dir, 'drops.jsonl') },
  }
}

/**
 * Full working-tree copy of the repo (incl. .git by default — the doctor's
 * version-bump check baselines against harness-v* tags). Excludes node_modules.
 * The copy's own entry points derive their root inside the copy, so faults
 * injected there never leak back.
 */
export function repoCopy({ withGit = true, from = REPO } = {}) {
  // realpath — see hermeticEnv(): without it the copy's own checks no-op
  // silently on macOS (main-guard never matches under /var → /private/var).
  const dest = realpathSync(mkdtempSync(join(tmpdir(), 'rig-repo-')))
  cpSync(from, dest, {
    recursive: true, force: true,
    filter: (src) => {
      const r = relative(from, src)
      if (!r || r.startsWith('..')) return true
      const segs = r.split(sep)
      if (segs.includes('node_modules')) return false
      if (!withGit && segs[0] === '.git') return false
      return true
    },
  })
  return dest
}

// ── normalization (golden master) ────────────────────────────────────────────

/**
 * Mask ONLY volatility: ids, timestamps, signal numbers, durations, versions,
 * temp/absolute paths, and warning counts (which legitimately drift as WARN-level
 * findings evolve). Error counts are NOT masked — they are semantic.
 */
export function normalize(text, { root = REPO } = {}) {
  return String(text)
    .replaceAll(root, '<ROOT>')
    .replace(/\/(?:private\/)?(?:var\/folders|tmp)\/[^\s'")\]]+/g, '<TMP>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<TS>')
    .replace(/#\d+/g, '#<N>')
    .replace(/\b\d+ms\b/g, '<MS>')
    .replace(/\bharness-v\d+\.\d+\b/g, 'harness-v<V>')
    .replace(/\bv\d+\.\d+(?:\.\d+)?\b/g, 'v<V>')
    .replace(/\b\d+ warnings?\b/g, '<W> warnings')
    .replace(/"warnings":\s*\d+/g, '"warnings":"<W>"')
}

// ── the §D2 eval catalogue ───────────────────────────────────────────────────
// Each eval returns { id, pass, detail, golden } — `golden` is the normalized
// artifact captured into golden-master.json (null = not golden material).

/** F1: explicit `os:` command → the hook BLOCKS with the real doctor result. */
export function evalF1(root = REPO) {
  const { dir, env } = hermeticEnv()
  try {
    const r = runNode(abs(PATHS.sessionFeedback, root), { args: ['--text', 'os: check the harness for drift'], cwd: root, env })
    let j = null
    try { j = JSON.parse(r.stdout) } catch { /* fall through */ }
    const pass = !!j && j.decision === 'block' && /🔁 OS loop/.test(j.reason || '') && /doctor: \d+ errors/.test(j.reason || '')
    return { id: 'F1', pass, detail: pass ? 'block + 🔁 + doctor result' : `status=${r.status} stdout=${r.stdout.slice(0, 400)} stderr=${r.stderr.slice(0, 200)}`, golden: j ? { decision: j.decision, reason: normalize(j.reason, { root }) } : null, recordDir: dir }
  } finally { /* caller may inspect recordDir; rm is done by tests */ }
}

/** F2: natural language → additionalContext carries the trace + operating protocol. */
export function evalF2(root = REPO) {
  const { env } = hermeticEnv()
  const r = runNode(abs(PATHS.sessionFeedback, root), { args: ['--text', 'what is drift in the harness'], cwd: root, env })
  let j = null
  try { j = JSON.parse(r.stdout) } catch { /* fall through */ }
  const ctx = j?.hookSpecificOutput?.additionalContext || ''
  const pass = j?.hookSpecificOutput?.hookEventName === 'UserPromptSubmit' && ctx.includes('OPERATING PROTOCOL') && ctx.includes('🔁 OS loop')
  return { id: 'F2', pass, detail: pass ? 'inject + protocol' : `stdout=${r.stdout.slice(0, 400)}`, golden: j ? { event: j.hookSpecificOutput?.hookEventName, context: normalize(ctx, { root }) } : null }
}

/** F3: statusline renders the 🔁 trace. (Read-only — no redirect needed.) */
export function evalF3(root = REPO) {
  const r = runNode(abs(PATHS.statusline, root), { input: '{}', cwd: root })
  const pass = r.status === 0 && r.stdout.trimStart().startsWith('🔁')
  return { id: 'F3', pass, detail: pass ? 'starts with 🔁' : `status=${r.status} stdout=${r.stdout.slice(0, 200)}`, golden: { startsWithTrace: pass } }
}

/** F4: orchestrator demo run routes to doctor and completes. */
export function evalF4(root = REPO) {
  const { env } = hermeticEnv()
  const r = runNode(abs(PATHS.orchestrator, root), { args: ['--demo', 'check', 'the', 'harness', 'for', 'drift'], cwd: root, env })
  const pass = r.status === 0 && r.stdout.includes('routed → doctor') && r.stdout.includes('outcome: completed')
  return { id: 'F4', pass, detail: pass ? 'routed → doctor, completed' : `status=${r.status} stdout=${r.stdout.slice(0, 400)}`, golden: { stdout: normalize(r.stdout, { root }) } }
}

/** C1/C2: confinement blocks a sibling-project read (exit 2) and allows an in-repo read (exit 0). */
export function evalC1(root = REPO) {
  const home = process.env.HOME || ''
  const payload = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: join(home, 'Projects', 'zz-rig-sibling-probe', 'x.txt') }, cwd: root })
  const r = runNode(abs(PATHS.confinement, root), { input: payload, cwd: root })
  const pass = r.status === 2 && /confinement/.test(r.stderr)
  return { id: 'C1', pass, detail: pass ? 'blocked (exit 2)' : `status=${r.status} stderr=${r.stderr.slice(0, 200)}`, golden: { status: r.status, stderr: normalize(r.stderr, { root }) } }
}
export function evalC2(root = REPO) {
  const payload = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: join(root, 'README.md') }, cwd: root })
  const r = runNode(abs(PATHS.confinement, root), { input: payload, cwd: root })
  const pass = r.status === 0
  return { id: 'C2', pass, detail: pass ? 'allowed (exit 0)' : `status=${r.status} stderr=${r.stderr.slice(0, 200)}`, golden: { status: r.status } }
}

/** Run one governance check via its CLI inside `root`; returns parsed --json + exit. */
export function runCheck(rel, root = REPO, extraArgs = []) {
  const r = runNode(abs(rel, root), { args: ['--json', ...extraArgs], cwd: root })
  let findings = []
  try {
    const j = JSON.parse(r.stdout)
    findings = j.findings || []
  } catch { /* non-JSON output — keep raw */ }
  const codes = (sev) => [...new Set(findings.filter((f) => f.severity === sev).map((f) => f.code))].sort()
  // A --json check that exits 0 with NO output did not actually run (e.g. its
  // main-guard never matched) — that silence must never read as a pass.
  const noOutput = r.status === 0 && !r.stdout.trim()
  return { status: noOutput ? -1 : r.status, noOutput, errors: codes('ERROR'), warns: codes('WARN'), stdout: r.stdout, stderr: r.stderr }
}

/** G1: all four checks exit 0 on the live tree. */
export function evalG1(root = REPO) {
  const out = {}
  for (const [name, rel] of [['doctor', PATHS.doctor], ['governance-check', PATHS.governanceCheck], ['structure-check', PATHS.structureCheck], ['no-ghost-agent', PATHS.noGhost]]) {
    const c = runCheck(rel, root)
    out[name] = { status: c.status, errors: c.errors, warns: c.warns }
  }
  const pass = Object.values(out).every((c) => c.status === 0)
  return { id: 'G1', pass, detail: JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.status]))), golden: out }
}

/** C3: doctor is deterministic + fast: 5 consecutive runs, all exit 0, each within budget. */
export function evalC3(root = REPO, { runs = 5, budgetMs = 30000 } = {}) {
  const times = []
  for (let i = 0; i < runs; i += 1) {
    const t0 = Date.now()
    const r = runNode(abs(PATHS.doctor, root), { args: ['--json'], cwd: root, timeout: budgetMs + 5000 })
    times.push({ ms: Date.now() - t0, status: r.status })
  }
  const pass = times.every((t) => t.status === 0 && t.ms <= budgetMs)
  return { id: 'C3', pass, detail: JSON.stringify(times), golden: null }
}

/** Read the last row of a redirected runs stream (O1). */
export function lastRunRow(recordDir) {
  const p = join(recordDir, 'runs.jsonl')
  if (!existsSync(p)) return null
  const lines = readFileSync(p, 'utf8').trim().split('\n').filter(Boolean)
  if (!lines.length) return null
  return JSON.parse(lines.at(-1))
}
