#!/usr/bin/env node
// governance/checks/structure-check.mjs — top-level schema drift check (FAIL-CLOSED).
//
// Enforces the canonical top-level directory schema (the six-concept OS +
// pinned host/back-of-house dirs):
//   harness/, apps/, skills/, governance/, record/, docs/,
//   state/, web/, .github/, .claude/, .system/
// (The frozen 'past' lives in the separate jeremy-james-state/os-archive repo,
//  not as a top-level folder here.)
//
// Hardened at os-reshape P1: canonical-shape drift (a missing or rogue
// top-level dir) is an ERROR and the check exits 1 — it no longer passes
// silently. The hand-maintained docs/OS-INDEX.md remains WARN-only.

import { realpathSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..', '..')
const EXPECTED_TOP_LEVEL_DIRS = ['harness', 'apps', 'skills', 'governance', 'record', 'docs', 'state', 'web', '.github', '.claude', '.system']
const EXPECTED = new Set(EXPECTED_TOP_LEVEL_DIRS)
// machine-local, gitignored noise — never repo structure (CI checkouts don't have them)
const IGNORED_TOP_LEVEL_DIRS = new Set(['.git', 'node_modules', '.obsidian'])

function finding(severity, code, message, fix) {
  return { severity, code, message, fix: fix || '' }
}

function isDirectory(path) {
  try { return statSync(path).isDirectory() } catch { return false }
}

export function runStructureCheck({ root = DEFAULT_ROOT } = {}) {
  const findings = []
  let entries = []
  try {
    entries = readdirSync(root)
  } catch (e) {
    // an unreadable root is itself a loud failure, never a silent pass
    findings.push(finding('ERROR', 'STRUCTURE_UNREADABLE', `Cannot read root '${root}': ${e.message}`, 'Fix the path/permissions.'))
    return { findings }
  }

  const topDirs = entries.filter((name) => isDirectory(join(root, name)) && !IGNORED_TOP_LEVEL_DIRS.has(name))
  const topDirSet = new Set(topDirs)

  for (const dir of EXPECTED_TOP_LEVEL_DIRS) {
    if (!topDirSet.has(dir)) {
      findings.push(finding(
        'ERROR',
        'STRUCTURE_DRIFT',
        `Expected top-level directory '${dir}/' is missing.`,
        `Restore '${dir}/' or, if this is intentional, record and approve a schema decision in governance/decisions/ and update the canonical list here.`,
      ))
    }
  }

  for (const dir of topDirs.sort((a, b) => a.localeCompare(b))) {
    if (EXPECTED.has(dir)) continue
    findings.push(finding(
      'ERROR',
      'STRUCTURE_DRIFT',
      `Unexpected top-level directory '${dir}/' is outside the canonical schema.`,
      `Relocate it under an allowed tier, archive it, or add a human-approved schema decision (and update the canonical list here) before introducing a new top-level folder.`,
    ))
  }

  // The maintained OS index (docs/OS-INDEX.md) is the human front door to the tiers. It is
  // hand-maintained prose (unlike the generated harness/index.md), so its absence is WARN-only.
  if (!existsSync(join(root, 'docs', 'OS-INDEX.md'))) {
    findings.push(finding(
      'WARN',
      'STRUCTURE_INDEX_MISSING',
      `docs/OS-INDEX.md (the maintained OS index) is missing.`,
      `Restore docs/OS-INDEX.md — the front-door map of the tiers.`,
    ))
  }

  return { findings }
}

function main() {
  const args = process.argv.slice(2)
  const { findings } = runStructureCheck()
  const errs = findings.filter((f) => f.severity === 'ERROR')
  const warns = findings.filter((f) => f.severity === 'WARN')
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({ findings }, null, 2) + '\n')
  } else {
    const print = (f) => {
      process.stdout.write(`  [${f.severity}] ${f.code}: ${f.message}\n`)
      if (f.fix) process.stdout.write(`           fix: ${f.fix}\n`)
    }
    process.stdout.write('\nstructure check\n')
    process.stdout.write(`  errors: ${errs.length}  warnings: ${warns.length}\n\n`)
    if (errs.length) { process.stdout.write('ERRORS (structure drift — fail-closed)\n'); errs.forEach(print); process.stdout.write('\n') }
    if (warns.length) { process.stdout.write('WARNINGS\n'); warns.forEach(print); process.stdout.write('\n') }
    process.stdout.write(errs.length ? 'RESULT: DRIFT (fail-closed)\n' : 'RESULT: OK\n')
  }
  process.exitCode = errs.length ? 1 : 0
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
