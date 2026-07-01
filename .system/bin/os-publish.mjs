#!/usr/bin/env node
/**
 * .system/bin/os-publish.mjs — cut, verify, and point at a sealed OS runtime.
 *
 *   node .system/bin/os-publish.mjs                 publish: assemble the snapshot for the
 *                                                   manifest's harnessVersion under
 *                                                   .system/releases/<v>/, CUT-THEN-VERIFY
 *                                                   (doctor + no-ghost + hostile boot smoke
 *                                                   INSIDE the snapshot), then atomically
 *                                                   repoint `current`. Refuses to repoint on
 *                                                   ANY verification failure.
 *   node .system/bin/os-publish.mjs --channel next  same, but repoints `next` (TestFlight).
 *   node .system/bin/os-publish.mjs --verify <dir>  verify an existing snapshot dir; explicit
 *                                                   refusal (exit 1) if torn/incomplete.
 *   node .system/bin/os-publish.mjs --boot-check    validate the booted channel: channel file →
 *                                                   pointer → snapshot version pin; prints the
 *                                                   boot banner; explicit loud refusal on stale
 *                                                   pointer / version mismatch / missing channel
 *                                                   target.
 *
 * The snapshot is the admitted closure + the doctor's full dependency chain:
 *   harness/ (loop, guard, spine manifest + schemas, render.mjs, generated md)
 *   governance/checks/ (the four checks + schema-validate)
 *   .system/releases/<v>.json (the pin file — release-consistency resolves inside)
 * record/ and state/ stay OUTSIDE (written every turn; the image is read-only).
 *
 * Zero-dependency. Fail-CLOSED throughout: this is a control, not observability.
 */
import { spawnSync } from 'node:child_process'
import {
  cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync,
  realpathSync, renameSync, rmSync, symlinkSync, writeFileSync, readdirSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = process.env.OS_ROOT ? resolve(process.env.OS_ROOT) : resolve(HERE, '..', '..')
const RELEASES = join(REPO, '.system', 'releases')
const CHANNEL_FILE = join(REPO, '.system', 'state', 'channel')

const die = (msg) => { process.stderr.write(`os-publish: REFUSED — ${msg}\n`); process.exit(1) }
const say = (msg) => process.stdout.write(msg + '\n')

// ── snapshot layout ──────────────────────────────────────────────────────────

/** Everything the sealed runtime needs, relative to the repo root. */
const CLOSURE = [
  'harness',              // loop/ + guard/ + spine + schemas + render + generated md
  'apps',                 // userland (incl. _drafts candidates) — the census inside the image must resolve
  'governance/checks',    // the doctor dependency chain (checks import siblings + ../../harness/render.mjs)
  '.system/bin',          // this publisher itself (census row .system/bin/os-publish.mjs)
]

function assembleSnapshot(version, { from = REPO } = {}) {
  const staging = join(RELEASES, `.staging-${version}-${process.pid}`)
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  const filter = (src) => {
    const r = relative(from, src)
    if (!r || r.startsWith('..')) return true
    const segs = r.split(sep)
    if (segs.includes('node_modules')) return false
    if (segs.at(-1)?.endsWith('.test.mjs')) return false // tests run in the workbench, not the sealed image
    return true
  }
  for (const rel of CLOSURE) {
    const src = join(from, rel)
    if (!existsSync(src)) { rmSync(staging, { recursive: true, force: true }); die(`closure member '${rel}' missing from the source tree`) }
    cpSync(src, join(staging, rel), { recursive: true, force: true, verbatimSymlinks: true, filter })
  }
  // the pin file — checkReleaseConsistency must resolve INSIDE the snapshot
  const pin = join(from, '.system', 'releases', `${version}.json`)
  if (!existsSync(pin)) { rmSync(staging, { recursive: true, force: true }); die(`pin file .system/releases/${version}.json missing — cut the release before publishing`) }
  mkdirSync(join(staging, '.system', 'releases'), { recursive: true })
  cpSync(pin, join(staging, '.system', 'releases', `${version}.json`))
  writeFileSync(join(staging, 'SNAPSHOT.json'), JSON.stringify({
    version, sealedAt: new Date().toISOString(),
    note: 'Sealed OS runtime snapshot. Read-only by convention; record/ + state/ live in the workbench.',
  }, null, 2) + '\n')
  return staging
}

// ── verification (cut-then-verify) ───────────────────────────────────────────

function runNode(script, { args = [], cwd, env = {}, input, timeout = 120000 } = {}) {
  const e = { ...process.env, ...env }
  delete e.OS_ROOT // the snapshot must self-resolve; leaked roots would mask non-containment
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env: e, input, timeout })
}

export function verifySnapshot(dir) {
  const problems = []
  if (!existsSync(dir)) return [`snapshot dir '${dir}' does not exist`]
  const snap = realpathSync(dir)

  // 1. shape: the closure is present
  for (const rel of ['harness/manifest.json', 'harness/loop/session-feedback/index.mjs', 'governance/checks/doctor.mjs']) {
    if (!existsSync(join(snap, rel))) problems.push(`torn snapshot: '${rel}' missing`)
  }
  if (problems.length) return problems

  // 2. version pin sane + pinned file present
  let version = null
  try { version = JSON.parse(readFileSync(join(snap, 'harness/manifest.json'), 'utf8')).harnessVersion } catch (e) { problems.push(`manifest unreadable inside snapshot: ${e.message}`) }
  if (!problems.length) {
    if (!version || typeof version !== 'string' || !version.trim()) problems.push('blank/invalid harnessVersion inside the snapshot manifest')
    else if (!existsSync(join(snap, '.system', 'releases', `${version}.json`))) problems.push(`pin file for version '${version}' missing inside the snapshot`)
  }
  if (problems.length) return problems

  // 3. the doctor runs INSIDE the snapshot and is clean
  const doctor = runNode(join(snap, 'governance/checks/doctor.mjs'), { args: ['--json'], cwd: snap })
  if (!doctor.stdout || !doctor.stdout.trim()) problems.push(`doctor produced no output inside the snapshot (exit ${doctor.status}) — not self-contained`)
  else {
    try {
      const { findings } = JSON.parse(doctor.stdout)
      const errs = (findings || []).filter((f) => f.severity === 'ERROR')
      if (errs.length) problems.push(`doctor RED inside the snapshot: ${errs.map((f) => f.code).join(', ')}`)
    } catch (e) { problems.push(`doctor output unparseable inside the snapshot: ${e.message}`) }
  }

  // 4. no-ghost runs INSIDE the snapshot
  const ghost = runNode(join(snap, 'governance/checks/no-ghost-agent.mjs'), { args: ['--json'], cwd: snap })
  if (ghost.status !== 0) problems.push(`no-ghost-agent failed inside the snapshot (exit ${ghost.status}): ${(ghost.stdout + ghost.stderr).slice(0, 200)}`)

  // 5. hostile boot smoke: the enforced os: path runs from the snapshot with a
  //    hermetic record dir and a cwd OUTSIDE the snapshot
  const rec = mkdtempSync(join(tmpdir(), 'os-publish-smoke-'))
  try {
    const boot = runNode(join(snap, 'harness/loop/session-feedback/index.mjs'), {
      args: ['--text', 'os: check the harness for drift'],
      cwd: tmpdir(),
      env: { OS_RECORD_DIR: rec, OS_DB: join(rec, 'os.db'), OS_DROPS: join(rec, 'drops.jsonl') },
    })
    let verdict = null
    try { verdict = JSON.parse(boot.stdout) } catch { /* fall through */ }
    if (verdict?.decision !== 'block') problems.push(`hostile boot smoke failed: the enforced os: path did not block (status ${boot.status}, stdout ${boot.stdout.slice(0, 160)}, stderr ${boot.stderr.slice(0, 160)})`)
    else if (!/doctor: \d+ errors/.test(verdict.reason || '')) problems.push('hostile boot smoke: block decision carries no real doctor verdict')
  } finally { rmSync(rec, { recursive: true, force: true }) }

  // 6. the data layer stays external
  for (const banned of ['record', 'state']) {
    if (existsSync(join(snap, banned))) problems.push(`snapshot contains ${banned}/ — the data layer must stay OUTSIDE the read-only image`)
  }
  return problems
}

// ── pointers + channels ──────────────────────────────────────────────────────

/** Resolve a pointer (current/next): symlink → target dir; plain file → named version dir. */
function resolvePointer(name) {
  const p = join(RELEASES, name)
  if (!existsSync(p) && !isSymlink(p)) return { exists: false, p }
  if (isSymlink(p)) {
    const target = join(RELEASES, readlinkSync(p))
    return { exists: true, p, dir: target, form: 'symlink' }
  }
  const st = lstatSync(p)
  if (st.isDirectory()) return { exists: true, p, dir: p, form: 'dir' }
  const v = readFileSync(p, 'utf8').trim()
  return { exists: true, p, dir: join(RELEASES, v), form: 'file', version: v }
}
function isSymlink(p) { try { return lstatSync(p).isSymbolicLink() } catch { return false } }

function repoint(name, versionDirName) {
  const tmp = join(RELEASES, `.${name}-tmp-${process.pid}`)
  rmSync(tmp, { force: true })
  symlinkSync(versionDirName, tmp) // relative target — snapshot dirs are siblings
  renameSync(tmp, join(RELEASES, name)) // atomic on POSIX
}

export function bootCheck() {
  let channel = 'current'
  if (existsSync(CHANNEL_FILE)) {
    channel = readFileSync(CHANNEL_FILE, 'utf8').trim() || 'current'
    if (!['current', 'next'].includes(channel)) die(`channel file names unknown channel '${channel}' (expected current|next)`)
  }
  const ptr = resolvePointer(channel)
  if (!ptr.exists) die(`channel '${channel}' has no pointer at .system/releases/${channel} — nothing published${channel === 'next' ? ' on the next channel (channel mismatch)' : ''}`)
  if (!existsSync(ptr.dir)) die(`stale pointer: channel '${channel}' points at '${ptr.version ?? ptr.dir}' which does not exist`)
  const problems = verifySnapshot(ptr.dir)
  if (problems.length) die(`channel '${channel}' snapshot failed verification:\n  • ${problems.join('\n  • ')}`)
  const manifest = JSON.parse(readFileSync(join(ptr.dir, 'harness/manifest.json'), 'utf8'))
  const n = (manifest.components || []).length
  let sha = ''
  try { sha = spawnSync('git', ['-C', REPO, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim() } catch { /* no git */ }
  say(`🖥 OS v${manifest.harnessVersion} booted · channel ${channel} · ${n} components${sha ? ` · ${sha}` : ''}`)
}

// ── main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2)

  if (args.includes('--boot-check')) { bootCheck(); return }

  if (args.includes('--verify')) {
    const dir = args[args.indexOf('--verify') + 1]
    if (!dir) die('usage: --verify <snapshot-dir>')
    const problems = verifySnapshot(resolve(dir))
    if (problems.length) die(`snapshot verification failed:\n  • ${problems.join('\n  • ')}`)
    say('snapshot verified ✓')
    return
  }

  // publish
  const channel = args.includes('--channel') ? args[args.indexOf('--channel') + 1] : 'current'
  if (!['current', 'next'].includes(channel)) die(`unknown channel '${channel}' (expected current|next)`)
  let version
  try { version = JSON.parse(readFileSync(join(REPO, 'harness/manifest.json'), 'utf8')).harnessVersion } catch (e) { die(`cannot read the workbench manifest: ${e.message}`) }
  if (!version || !String(version).trim()) die('workbench manifest has a blank harnessVersion')

  const dest = join(RELEASES, version)
  if (existsSync(dest) && !args.includes('--force')) die(`release ${version} is already sealed (${dest}); releases are immutable — bump + re-cut, or --force to reseal`)

  const staging = assembleSnapshot(version)
  const problems = verifySnapshot(staging)
  if (problems.length) {
    rmSync(staging, { recursive: true, force: true })
    die(`cut-then-verify failed — NOT repointing '${channel}':\n  • ${problems.join('\n  • ')}`)
  }
  rmSync(dest, { recursive: true, force: true })
  renameSync(staging, dest)
  repoint(channel, version)
  say(`sealed ${version} → .system/releases/${version}/ · ${channel} → ${version} ✓`)
}


/**
 * CLI main-guard, symlink-proof: node resolves import.meta.url to the REAL
 * path, while argv[1] may arrive through a symlink (.system/releases/current,
 * macOS /var, a spaced path). Comparing unresolved forms silently skips main()
 * — exit 0, no output — the exact silent-failure class caught twice in the
 * os-reshape (P0 rig, P2 sealed boot). Realpath both sides; any error → false.
 */
function cliInvoked(metaUrl) {
  try { return !!process.argv[1] && metaUrl === pathToFileURL(realpathSync(process.argv[1])).href } catch { return false }
}

if (cliInvoked(import.meta.url)) main()
