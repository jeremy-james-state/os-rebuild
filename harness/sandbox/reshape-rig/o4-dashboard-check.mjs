#!/usr/bin/env node
/**
 * reshape-rig/o4-dashboard-check.mjs — O4 / NN2 (availability-only).
 *
 * Fetches the live dashboard and asserts 200 + a non-empty HTML document, and
 * runs the Supabase sync asserting exit 0 or the documented graceful skip.
 * Run BEFORE and AFTER the migration (P4) with output recorded in the
 * evidence pack. Network-dependent by nature — a script with recorded
 * evidence, not a CI unit test.
 *
 *   node o4-dashboard-check.mjs [--skip-sync]
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const DASHBOARD = 'https://web-lemon-ten-15.vercel.app'

let ok = true

// 1) dashboard availability (NN2)
try {
  const res = await fetch(DASHBOARD, { redirect: 'follow', signal: AbortSignal.timeout(20000) })
  const body = await res.text()
  const alive = res.status === 200 && body.length > 500 && /<(!doctype|html)/i.test(body)
  process.stdout.write(`O4 dashboard: HTTP ${res.status}, ${body.length} bytes → ${alive ? 'ALIVE ✓' : 'NOT OK ✗'}\n`)
  if (!alive) ok = false
} catch (e) {
  process.stdout.write(`O4 dashboard: fetch failed — ${e.message} ✗\n`)
  ok = false
}

// 2) sync exit 0 / graceful skip (availability-only ruling: a keyless machine
//    must SKIP loudly-but-cleanly, exit 0, never crash)
if (!process.argv.includes('--skip-sync')) {
  const syncPath = ['scripts/sync-supabase.mjs', '.system/sync/sync-supabase.mjs'].map((p) => join(REPO, p)).find(existsSync)
  if (!syncPath) {
    process.stdout.write('O4 sync: sync-supabase.mjs NOT FOUND at either known location ✗\n')
    ok = false
  } else {
    const r = spawnSync(process.execPath, [syncPath], { encoding: 'utf8', timeout: 60000 })
    const graceful = r.status === 0
    process.stdout.write(`O4 sync (${syncPath.slice(REPO.length + 1)}): exit ${r.status} → ${graceful ? 'OK/graceful-skip ✓' : 'FAILED ✗'}\n${(r.stdout + r.stderr).trim().split('\n').slice(0, 5).map((l) => `    ${l}`).join('\n')}\n`)
    if (!graceful) ok = false
  }
}

process.exit(ok ? 0 : 1)
