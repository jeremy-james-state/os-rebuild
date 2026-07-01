#!/usr/bin/env node
/**
 * sync — CANDIDATE (pre-admission; see governance/rules/harness-admission.md). Pushes record/signals.jsonl (the git truth) up to the
 * Supabase os_signals table (a hosted projection). Idempotent upsert on the primary key `n`.
 *
 * The Claude container cannot reach Supabase directly (network policy), so this runs in CI
 * (.github/workflows/sync-signals.yml) on every push that touches record/signals.jsonl — the
 * per-turn commit becomes the sync heartbeat. Credentials come from the environment
 * (SUPABASE_URL non-secret + SUPABASE_SERVICE_KEY from GitHub Actions secrets), never the repo.
 *
 * No-op (not an error) when credentials are absent, so it is safe to run anywhere.
 * Zero-dependency (Node 22 fetch + the ledger reader).
 */
import { readSignals, recordPath } from './ledger.mjs'

const TABLE = 'os_signals'
const COLS = ['n', 'id', 'ts', 'session', 'run', 'call', 'branch', 'source', 'summary', 'phase']

/** Map raw signal records → Supabase row objects (only 'create' rows, the columns the table holds). */
export function toRows(records) {
  return records
    .filter((r) => r && r.op === 'create' && typeof r.n === 'number')
    .map((r) => Object.fromEntries(COLS.map((c) => [c, r[c] ?? null])))
    .sort((a, b) => a.n - b.n)
}

/**
 * Upsert all signals to Supabase. Returns { ok, synced } or { ok:false, reason } — never throws
 * on missing credentials (returns reason:'no-credentials') so CI/local runs degrade gracefully.
 */
export async function sync({
  url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_KEY,
  recordFile = recordPath(),
  fetchImpl = fetch,
} = {}) {
  if (!url || !key) return { ok: false, reason: 'no-credentials', synced: 0 }
  const rows = toRows(readSignals(recordFile).records)
  if (!rows.length) return { ok: true, synced: 0 }
  const res = await fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal', // upsert on the primary key (n)
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, reason: `http ${res.status}: ${body.slice(0, 300)}`, synced: 0 }
  }
  return { ok: true, synced: rows.length }
}

async function main() {
  const r = await sync()
  if (r.reason === 'no-credentials') {
    process.stdout.write('sync: no SUPABASE_URL / SUPABASE_SERVICE_KEY — skipping (set them in CI secrets).\n')
    return
  }
  if (!r.ok) { process.stderr.write(`sync FAILED: ${r.reason}\n`); process.exitCode = 1; return }
  process.stdout.write(`sync: upserted ${r.synced} signal(s) to Supabase ${TABLE}.\n`)
}
if (import.meta.url === `file://${process.argv[1]}`) main()
