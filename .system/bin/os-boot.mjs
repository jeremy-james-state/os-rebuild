#!/usr/bin/env node
/**
 * .system/bin/os-boot.mjs — the STABLE launcher the host wires to.
 *
 *   node .system/bin/os-boot.mjs session-feedback   [...args]
 *   node .system/bin/os-boot.mjs statusline         [...args]
 *
 * Resolves the channel (.system/state/channel, default `current`), boots the
 * named hook FROM THE SEALED SNAPSHOT that channel points at, and keeps the
 * data layer EXTERNAL (record/ + state/ of the workbench) via env. This file
 * is deliberately tiny and unversioned-stable: `.claude/settings.json` points
 * here once, and channel toggles / release promotions never touch host wiring.
 *
 * Failure posture (per hook contract, availability over false authority):
 * a boot problem NEVER wedges the turn — but it is LOUD, not silent:
 *   session-feedback → injects a ⚠ additionalContext block naming the problem
 *   statusline       → prints a ⛔ banner
 * Exit is always 0 on boot failure (fail-open), and the child's own exit code
 * passes through on success (a PreToolUse block must still block).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const RELEASES = join(REPO, '.system', 'releases')
const CHANNEL_FILE = join(REPO, '.system', 'state', 'channel')

const HOOKS = {
  'session-feedback': 'harness/loop/session-feedback/index.mjs',
  'statusline': 'harness/loop/session-feedback/statusline.mjs',
  'confinement': 'harness/guard/confinement/index.mjs',
  'harness-lock': 'harness/guard/harness-lock/index.mjs',
}

function fail(hook, msg) {
  // loud fail-open, shaped for the surface that called us
  if (hook === 'statusline') process.stdout.write(`⛔ OS boot failed: ${msg}\n`)
  else if (hook === 'session-feedback') process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: `[HARNESS] ⚠ SEALED BOOT FAILED — ${msg}. The loop did NOT run this turn. Fix the channel/snapshot (node .system/bin/os-publish.mjs --boot-check).` },
  }) + '\n')
  else process.stderr.write(`os-boot(${hook}): ${msg} — failing OPEN (tool call allowed)\n`)
  process.exit(0)
}

const hook = process.argv[2]
const rest = process.argv.slice(3)
if (!hook || !HOOKS[hook]) {
  process.stderr.write(`os-boot: unknown hook '${hook}' (known: ${Object.keys(HOOKS).join(', ')})\n`)
  process.exit(hook ? 2 : 0)
}

let channel = 'current'
try { channel = (readFileSync(CHANNEL_FILE, 'utf8').trim() || 'current') } catch { /* default */ }
if (!['current', 'next'].includes(channel)) fail(hook, `channel file names unknown channel '${channel}'`)

const ptr = join(RELEASES, channel)
let snapDir = null
try {
  const st = lstatSync(ptr)
  if (st.isSymbolicLink()) snapDir = join(RELEASES, readlinkSync(ptr))
  else if (st.isDirectory()) snapDir = ptr
  else snapDir = join(RELEASES, readFileSync(ptr, 'utf8').trim())
} catch { fail(hook, `channel '${channel}' has no pointer (.system/releases/${channel})`) }
if (!snapDir || !existsSync(snapDir)) fail(hook, `stale pointer: channel '${channel}' → missing snapshot`)

const script = join(snapDir, HOOKS[hook])
if (!existsSync(script)) fail(hook, `snapshot at channel '${channel}' is missing ${HOOKS[hook]}`)

if (channel === 'next') process.stderr.write(`🧪 TestFlight: booting channel NEXT (${snapDir.split('/').pop()})\n`)

const r = spawnSync(process.execPath, [script, ...rest], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // the data layer stays in the WORKBENCH — the image is read-only
    OS_RECORD_DIR: process.env.OS_RECORD_DIR || join(REPO, 'record'),
    OS_DB: process.env.OS_DB || join(REPO, 'state', 'os.db'),
    OS_DROPS: process.env.OS_DROPS || join(REPO, 'state', 'loop-store-drops.jsonl'),
  },
})
process.exit(r.status ?? 0)
