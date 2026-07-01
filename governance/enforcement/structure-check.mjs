#!/usr/bin/env node
// governance/enforcement/structure-check.mjs — top-level schema drift check (WARN-only).
//
// Enforces the canonical top-level directory schema:
//   harness/, governance/, docs/, record/, state/, .github/, .claude/
// (The frozen 'past' lives in the separate jeremy-james-state/os-archive repo,
//  not as a top-level folder here.)
//
// Any shape drift is WARN-only (exit 0).

import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..', '..')
const EXPECTED_TOP_LEVEL_DIRS = ['harness', 'governance', 'docs', 'record', 'state', '.github', '.claude']
const EXPECTED = new Set(EXPECTED_TOP_LEVEL_DIRS)
const IGNORED_TOP_LEVEL_DIRS = new Set(['.git'])

function finding(severity, code, message, fix) {
  return { severity, code, message, fix: fix || '' }
}

function isDirectory(path) {
  try { return statSync(path).isDirectory() } catch { return false }
}

export function runStructureCheck({ root = DEFAULT_ROOT } = {}) {
  const findings = []
  let entries = []
  try { entries = readdirSync(root) } catch { return { findings } }

  const topDirs = entries.filter((name) => isDirectory(join(root, name)) && !IGNORED_TOP_LEVEL_DIRS.has(name))
  const topDirSet = new Set(topDirs)

  for (const dir of EXPECTED_TOP_LEVEL_DIRS) {
    if (!topDirSet.has(dir)) {
      findings.push(finding(
        'WARN',
        'STRUCTURE_DRIFT',
        `Expected top-level directory '${dir}/' is missing.`,
        `Restore '${dir}/' or, if this is intentional, record and approve a schema decision in governance/decisions/.`,
      ))
    }
  }

  for (const dir of topDirs.sort((a, b) => a.localeCompare(b))) {
    if (EXPECTED.has(dir)) continue
    findings.push(finding(
      'WARN',
      'STRUCTURE_DRIFT',
      `Unexpected top-level directory '${dir}/' is outside the canonical schema.`,
      `Relocate it under an allowed tier, archive it, or add a human-approved schema decision before introducing a new top-level folder.`,
    ))
  }

  // The maintained OS index (docs/OS-INDEX.md) is the human front door to the tiers. It is
  // hand-maintained prose (unlike the generated harness/index.md), so its absence is WARN-only.
  if (!existsSync(join(root, 'docs', 'OS-INDEX.md'))) {
    findings.push(finding(
      'WARN',
      'STRUCTURE_DRIFT',
      `docs/OS-INDEX.md (the maintained OS index) is missing.`,
      `Restore docs/OS-INDEX.md — the front-door map of the four tiers.`,
    ))
  }

  return { findings }
}

function main() {
  const args = process.argv.slice(2)
  const { findings } = runStructureCheck()
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({ findings }, null, 2) + '\n')
  } else {
    const warns = findings.filter((f) => f.severity === 'WARN')
    const print = (f) => {
      process.stdout.write(`  [${f.severity}] ${f.code}: ${f.message}\n`)
      if (f.fix) process.stdout.write(`           fix: ${f.fix}\n`)
    }
    process.stdout.write('\nstructure check\n')
    process.stdout.write(`  errors: 0  warnings: ${warns.length}\n\n`)
    if (warns.length) { process.stdout.write('WARNINGS (structure drift)\n'); warns.forEach(print); process.stdout.write('\n') }
    process.stdout.write('RESULT: OK (warn-only)\n')
  }
  process.exitCode = 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
