#!/usr/bin/env node
/**
 * data-lock — make the append-only record/ data provably un-overwritable.
 *
 *   node .system/sync/data-lock.mjs lock     # snapshot + backup + chflags uchg + chmod 0444, then PROVE it
 *   node .system/sync/data-lock.mjs verify   # re-checksum vs the baseline → identical or DRIFT
 *   node .system/sync/data-lock.mjs unlock   # chflags nouchg + restore write bits (data stays appendable)
 *
 * Why chflags uchg and not just chmod: on macOS `chmod a-w` does NOT stop deletion (rm depends
 * on the DIRECTORY bit). `chflags uchg` (user-immutable) blocks overwrite, append, rename AND
 * delete of the file itself — even by the owner — until `chflags nouchg`. We set both.
 *
 * Protected set (tracked, append-only evidence):
 *   record/governance-ledger.jsonl · record/SCHEMA.md · record/incidents/** · record/handoffs/**
 *
 * The lock command self-PROVES the mechanism on a scratch file before reporting success: it
 * locks a probe and asserts append + overwrite + delete are all rejected. Zero-dependency.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { realpathSync,
  existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, chmodSync,
  appendFileSync, unlinkSync, readdirSync, statSync, rmSync,
} from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..', '..')
const isMac = process.platform === 'darwin'

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

/** The protected files under a root (absolute paths, existing only). */
export function protectedFiles(root = DEFAULT_ROOT) {
  const rec = join(root, 'record')
  const fixed = [join(rec, 'governance-ledger.jsonl'), join(rec, 'SCHEMA.md')]
  const trees = [join(rec, 'incidents'), join(rec, 'handoffs')].flatMap((d) => walk(d))
  return [...fixed, ...trees].filter((f) => existsSync(f))
}

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
function chflags(flag, file) { if (isMac) { try { execFileSync('chflags', [flag, file], { stdio: 'ignore' }) } catch (e) { /* surfaced by verify */ } } }

export function lock(root = DEFAULT_ROOT) {
  const files = protectedFiles(root)
  const lockDir = join(root, 'state', 'data-lock')
  mkdirSync(join(lockDir, 'backup'), { recursive: true })

  // 1) snapshot + 2) backup
  const baseline = {}
  for (const f of files) {
    const rel = relative(root, f)
    baseline[rel] = sha(f)
    const dest = join(lockDir, 'backup', rel)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(f, dest)
  }
  writeFileSync(join(lockDir, 'baseline.json'), JSON.stringify(baseline, null, 2) + '\n')

  // 3) lock: read-only + immutable
  for (const f of files) { try { chmodSync(f, 0o444) } catch {} ; chflags('uchg', f) }

  // 4) PROVE the mechanism on a scratch probe (never touches real data)
  const proof = proveImmutability(lockDir)
  return { files: files.length, baseline: Object.keys(baseline).length, proof }
}

/** Lock a scratch file and assert append + overwrite + delete are all rejected. */
export function proveImmutability(lockDir = join(DEFAULT_ROOT, 'state', 'data-lock')) {
  mkdirSync(lockDir, { recursive: true })
  const probe = join(lockDir, '.probe')
  try { chflags('nouchg', probe); if (existsSync(probe)) unlinkSync(probe) } catch {}
  writeFileSync(probe, 'locked\n'); chmodSync(probe, 0o444); chflags('uchg', probe)

  const rejected = (fn) => { try { fn(); return false } catch { return true } }
  const result = {
    append: rejected(() => appendFileSync(probe, 'x')),
    overwrite: rejected(() => writeFileSync(probe, 'x')),
    delete: rejected(() => unlinkSync(probe)),
  }
  // cleanup the probe
  try { chflags('nouchg', probe); chmodSync(probe, 0o644); unlinkSync(probe) } catch {}
  result.allRejected = result.append && result.overwrite && result.delete && isMac
  result.platform = process.platform
  return result
}

export function verify(root = DEFAULT_ROOT) {
  const lockDir = join(root, 'state', 'data-lock')
  const basePath = join(lockDir, 'baseline.json')
  if (!existsSync(basePath)) return { ok: false, reason: 'no baseline — run lock first', drift: [] }
  const baseline = JSON.parse(readFileSync(basePath, 'utf8'))
  const drift = []
  for (const [rel, want] of Object.entries(baseline)) {
    const f = join(root, rel)
    if (!existsSync(f)) { drift.push({ rel, reason: 'MISSING' }); continue }
    const got = sha(f)
    if (got !== want) drift.push({ rel, reason: 'CHANGED', want, got })
  }
  return { ok: drift.length === 0, checked: Object.keys(baseline).length, drift }
}

export function unlock(root = DEFAULT_ROOT) {
  const files = protectedFiles(root)
  for (const f of files) { chflags('nouchg', f); try { chmodSync(f, 0o644) } catch {} }
  return { files: files.length }
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function main() {
  const [cmd, rootArg] = process.argv.slice(2)
  const root = rootArg ? resolve(rootArg) : DEFAULT_ROOT
  if (cmd === 'lock') {
    const r = lock(root)
    console.log(`locked ${r.files} files (baseline ${r.baseline}).`)
    console.log(`  proof — append rejected: ${r.proof.append} · overwrite rejected: ${r.proof.overwrite} · delete rejected: ${r.proof.delete}`)
    console.log(r.proof.allRejected ? '  RESULT: lock PROVEN (append+overwrite+delete all rejected).'
      : `  RESULT: lock NOT proven on ${r.proof.platform} (chflags uchg is macOS-only).`)
    process.exitCode = r.proof.allRejected ? 0 : 1
  } else if (cmd === 'verify') {
    const r = verify(root)
    if (r.ok) console.log(`verify: ${r.checked} files byte-identical to baseline — data unchanged. ✓`)
    else { console.log(`verify: DRIFT — ${JSON.stringify(r.drift, null, 2)}`); process.exitCode = 1 }
  } else if (cmd === 'unlock') {
    const r = unlock(root); console.log(`unlocked ${r.files} files (data is appendable again).`)
  } else {
    console.log('usage: node .system/sync/data-lock.mjs <lock|verify|unlock> [root]')
    process.exitCode = 2
  }
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
