#!/usr/bin/env node
/**
 * reshape-rig/x-writer.mjs — child writer for the X2 multi-session
 * completeness rig: appends `n` rows to the `runs` stream in `dir` as fast as
 * possible, so several concurrent writers contend for the loop-store lock.
 * All writes are confined to `dir` (a rig temp dir).
 */
import { join } from 'node:path'
import { append } from '../loop-store/index.mjs'

const [dir, n, label] = process.argv.slice(2)
if (!dir || !n || !label) { process.stderr.write('usage: x-writer.mjs <dir> <n> <label>\n'); process.exit(2) }

let failed = 0
for (let i = 0; i < Number(n); i += 1) {
  try {
    append('runs', { kind: 'x2-probe', label, i }, { dir, drops: join(dir, 'drops.jsonl') })
  } catch { failed += 1 }
}
process.stdout.write(JSON.stringify({ label, wrote: Number(n) - failed, failed }) + '\n')
