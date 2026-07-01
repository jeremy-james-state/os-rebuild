#!/usr/bin/env node
/**
 * reshape-rig/x-locker.mjs — live lock holder for the X2b lock-steal rig.
 *
 * Acquires the loop-store stream lock exactly the way loop-store does
 * (O_EXCL on <dir>/runs.jsonl.lock), HOLDS it for `holdMs` while alive, then
 * releases and prints {acquiredAt, releasedAt} (epoch ms). A correct
 * single-writer protocol must NOT steal this lock while the holder lives —
 * loop-store today force-breaks it after ~1s of spinning (the P3 fix target).
 */
import { closeSync, openSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const [dir, holdMsArg] = process.argv.slice(2)
if (!dir || !holdMsArg) { process.stderr.write('usage: x-locker.mjs <dir> <holdMs>\n'); process.exit(2) }

const lockPath = join(dir, 'runs.jsonl.lock')
const fd = openSync(lockPath, 'wx')
const acquiredAt = Date.now()
await new Promise((r) => setTimeout(r, Number(holdMsArg)))
try { closeSync(fd) } catch { /* already closed */ }
try { unlinkSync(lockPath) } catch { /* stolen — the rig detects this via timing */ }
process.stdout.write(JSON.stringify({ acquiredAt, releasedAt: Date.now() }) + '\n')
