#!/usr/bin/env node
/**
 * sync-supabase.mjs — push the loop's data layer to the version-stamped hosted projection
 * (osr_loop_events) that the Vercel dashboard reads. This supersedes the older osr_events
 * table: osr_loop_events is a superset that additionally stamps harness_version /
 * component_version onto every row.
 *
 *   record/<stream>.jsonl  (truth, git)  ──►  Supabase public.osr_loop_events  ──►  Vercel dashboard
 *
 * Reads every loop stream via loop-store and UPSERTs into osr_loop_events (on id). The dashboard
 * reads osr_loop_events with the public (anon) key under RLS (select-only); writes need a key that
 * can insert, so this script uses a SERVICE key from the environment — never committed.
 *
 *   OS_SUPABASE_URL   default: https://pirwnoingtczdamdirqw.supabase.co
 *   OS_SUPABASE_KEY   required: a service_role key (or any key whose RLS allows insert)
 *
 *   node harness/loop/loop-store/index.mjs project   # refresh state/os.db (optional)
 *   OS_SUPABASE_KEY=sb_secret_... node .system/sync/sync-supabase.mjs
 *
 * Zero-dependency (global fetch). Idempotent (merge-duplicates on id). Truth stays in git;
 * Supabase is only a rebuildable projection.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { read, STREAMS } from '../../harness/loop/loop-store/index.mjs'

const URL = process.env.OS_SUPABASE_URL || 'https://pirwnoingtczdamdirqw.supabase.co'
// Key resolution: env var first, then a gitignored local file (<repo>/.supabase-key), so the
// automated LOCAL sync needs no env fiddling — drop the key in that file and it just works.
// The file is gitignored and never committed.
export function resolveKey({ keyFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.supabase-key') } = {}) {
  if (process.env.OS_SUPABASE_KEY) return process.env.OS_SUPABASE_KEY.trim()
  try {
    // NB: `const URL` above shadows the global URL constructor, so compute the path via
    // node:path (not `new URL`) to avoid a "URL is not a constructor" throw.
    const k = readFileSync(keyFile, 'utf8').trim()
    if (k) return k
  } catch { /* no key file — fine, we skip below */ }
  return null
}
const KEY = resolveKey()

function toRow(r) {
  return {
    id: r.id, stream: r.stream, n: r.n ?? 0, ts: r.ts ?? null,
    kind: r.kind ?? null, status: r.status ?? null,
    summary: r.summary != null ? String(r.summary).slice(0, 500) : null,
    trace_id: r.traceId ?? null, span_id: r.spanId ?? null, parent_span_id: r.parentSpanId ?? null,
    session: r.session ?? null, run: r.run ?? null,
    call: typeof r.call === 'number' ? r.call : null, branch: r.branch ?? null,
    harness_version: r.harnessVersion ?? null, component_version: r.componentVersion ?? null,
    payload: r,
  }
}

async function main() {
  if (!KEY) { console.log('sync: no OS_SUPABASE_KEY (env or <repo>/.supabase-key) — skipping; the dashboard sync stays idle until a key is provided.'); process.exit(0) }
  const rows = []
  for (const s of STREAMS) for (const r of read(s).records) rows.push(toRow(r))
  if (!rows.length) { console.log('nothing to sync (no records yet).'); return }

  const res = await fetch(`${URL}/rest/v1/osr_loop_events`, {
    method: 'POST',
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) { console.error(`sync failed: HTTP ${res.status} ${await res.text()}`); process.exit(1) }
  console.log(`synced ${rows.length} events → ${URL}/rest/v1/osr_loop_events`)
}
// Only run when invoked directly as a CLI — so importing this module (e.g. to test resolveKey)
// does NOT fire the live sync. Mirrors data-lock.mjs's entrypoint guard.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('sync error:', e.message); process.exit(1) })
}
