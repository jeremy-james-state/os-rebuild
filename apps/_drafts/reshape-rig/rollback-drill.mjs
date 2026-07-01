#!/usr/bin/env node
/**
 * reshape-rig/rollback-drill.mjs — R1: prove adoption is reversible.
 *
 * Executable ONLY at P4, after the adoption commit exists (it needs a real
 * commit to revert). Procedure it automates, in a repo COPY (never the live
 * tree):
 *   1. clone the repo copy at the adoption commit
 *   2. `git revert --no-edit <adoption-sha>`
 *   3. re-run F1–F4 against the reverted tree → all must pass
 *   4. print the evidence block (exit 0 = drill proven)
 *
 *   node rollback-drill.mjs <adoption-sha>
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { REPO, PATHS, evalF1, evalF2, evalF3, evalF4 } from './rig.mjs'

const sha = process.argv[2]
if (!sha) {
  process.stderr.write('R1 rollback drill: usage: rollback-drill.mjs <adoption-sha>\n' +
    'Not executable before the adoption commit exists (P4). This scaffold is the drill; P4 runs it.\n')
  process.exit(2)
}

const work = mkdtempSync(join(tmpdir(), 'r1-drill-'))
const git = (args, cwd = work) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
try {
  execFileSync('git', ['clone', '--quiet', REPO, work], { encoding: 'utf8' })
  git(['checkout', '--quiet', sha])
  git(['revert', '--no-edit', sha])
  const results = [evalF1(work), evalF2(work), evalF3(work), evalF4(work)]
  for (const r of results) process.stdout.write(`  ${r.id}: ${r.pass ? 'GREEN' : 'RED — ' + r.detail}\n`)
  const ok = results.every((r) => r.pass)
  process.stdout.write(ok ? 'R1 rollback drill: adoption revert leaves the loop fully functional ✓\n'
    : 'R1 rollback drill FAILED — adoption is not cleanly revertible\n')
  process.exit(ok ? 0 : 1)
} finally {
  rmSync(work, { recursive: true, force: true })
}
