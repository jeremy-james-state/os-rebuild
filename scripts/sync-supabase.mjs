#!/usr/bin/env node
/**
 * sync-supabase.mjs — push the loop's data layer to the hosted projection (osr_events)
 * that the Vercel dashboard reads.
 *
 *   record/<stream>.jsonl  (truth, git)  ──►  Supabase public.osr_events  ──►  Vercel dashboard
 *
 * Reads every loop stream via loop-store and UPSERTs into osr_events (on id). The dashboard
 * reads osr_events with the public (anon) key under RLS (select-only); writes need a key that
 * can insert, so this script uses a SERVICE key from the environment — never committed.
 *
 *   OS_SUPABASE_URL   default: https://pirwnoingtczdamdirqw.supabase.co
 *   OS_SUPABASE_KEY   required: a service_role key (or any key whose RLS allows insert)
 *
 *   node harness/sandbox/loop-store/index.mjs project   # refresh state/os.db (optional)
 *   OS_SUPABASE_KEY=sb_secret_... node scripts/sync-supabase.mjs
 *
 * Zero-dependency (global fetch). Idempotent (merge-duplicates on id). Truth stays in git;
 * Supabase is only a rebuildable projection.
 */
import { read, STREAMS } from '../harness/sandbox/loop-store/index.mjs'

const URL = process.env.OS_SUPABASE_URL || 'https://pirwnoingtczdamdirqw.supabase.co'
const KEY = process.env.OS_SUPABASE_KEY

function toRow(r) {
  return {
    id: r.id, stream: r.stream, n: r.n ?? 0, ts: r.ts ?? null,
    kind: r.kind ?? null, status: r.status ?? null,
    summary: r.summary != null ? String(r.summary).slice(0, 500) : null,
    trace_id: r.traceId ?? null, span_id: r.spanId ?? null, parent_span_id: r.parentSpanId ?? null,
    session: r.session ?? null, run: r.run ?? null,
    call: typeof r.call === 'number' ? r.call : null, branch: r.branch ?? null,
    payload: r,
  }
}

async function main() {
  if (!KEY) { console.error('error: set OS_SUPABASE_KEY (a service_role key) — see the header.'); process.exit(2) }
  const rows = []
  for (const s of STREAMS) for (const r of read(s).records) rows.push(toRow(r))
  if (!rows.length) { console.log('nothing to sync (no records yet).'); return }

  const res = await fetch(`${URL}/rest/v1/osr_events`, {
    method: 'POST',
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) { console.error(`sync failed: HTTP ${res.status} ${await res.text()}`); process.exit(1) }
  console.log(`synced ${rows.length} events → ${URL}/rest/v1/osr_events`)
}
main().catch((e) => { console.error('sync error:', e.message); process.exit(1) })
