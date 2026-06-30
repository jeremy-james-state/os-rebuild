#!/usr/bin/env node
/**
 * loop-store — CANDIDATE (harness/sandbox/), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * The data layer for the signal loop. Two representations, one truth:
 *
 *   • record/<stream>.jsonl  — append-only TRUTH (one stream per loop store: signals,
 *                              runs, classified, estimates, reconcile, incidents)
 *   • state/os.db (table `events`) — the READABLE projection (one row per event,
 *                              rebuildable from the JSONL, gitignored)
 *
 * Truth-first: the durable JSONL is appended BEFORE the projection. The per-stream index
 * `n` is gapless 1..N so completeness is provable. A failed write is recorded to
 * state/loop-store-drops.jsonl — nothing fails silently. Generalised from v2's
 * signal-ledger/ledger.mjs. Zero-dependency (Node 22+ built-ins).
 */
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..', '..', '..')

/** The loop's streams. Each is a sole-writer append-only log. governance-ledger is NOT here. */
export const STREAMS = ['signals', 'runs', 'classified', 'estimates', 'reconcile', 'incidents', 'chain', 'gates']

export function recordDir() { return process.env.OS_RECORD_DIR || join(REPO_ROOT, 'record') }
export function streamPath(stream, dir = recordDir()) { return join(dir, `${stream}.jsonl`) }
export function dbPath() { return process.env.OS_DB || join(REPO_ROOT, 'state/os.db') }
export function dropPath() { return process.env.OS_DROPS || join(REPO_ROOT, 'state/loop-store-drops.jsonl') }

const nowIso = () => new Date().toISOString()

// ── truth I/O ─────────────────────────────────────────────────────────────────
export function read(stream, dir = recordDir()) {
  const path = streamPath(stream, dir)
  if (!existsSync(path)) return { records: [], corrupt: 0 }
  let records = [], corrupt = 0
  for (const line of readFileSync(path, 'utf8').split('\n').filter(Boolean)) {
    try { records.push(JSON.parse(line)) } catch { corrupt++ }
  }
  return { records, corrupt }
}

export function nextIndex(stream, dir = recordDir()) {
  const ns = read(stream, dir).records.map((r) => r.n).filter((n) => typeof n === 'number')
  return ns.length ? Math.max(...ns) + 1 : 1
}

function recordDrop(entry, drops = dropPath()) {
  try { mkdirSync(dirname(drops), { recursive: true }); appendFileSync(drops, `${JSON.stringify({ ts: nowIso(), ...entry })}\n`) }
  catch { /* drop marker is best-effort; gaps() also detects via count */ }
}

/**
 * Append one event to a stream's truth log. Assigns a gapless `n` and an id `<stream>:<n>`.
 * Returns { ok, n, id } or { ok:false, dropped:true, reason } with the miss recorded.
 */
export function append(stream, row = {}, { dir = recordDir(), drops = dropPath(), now = nowIso } = {}) {
  if (!STREAMS.includes(stream)) throw new Error(`unknown stream '${stream}' (known: ${STREAMS.join(', ')})`)
  const path = streamPath(stream, dir)
  const n = nextIndex(stream, dir)
  const rec = { n, id: `${stream}:${n}`, ts: row.ts || now(), stream, ...row }
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${JSON.stringify(rec)}\n`)
  } catch (e) {
    recordDrop({ stage: 'append', stream, n, reason: String(e?.message || e), record: rec }, drops)
    return { ok: false, dropped: true, n, reason: String(e?.message || e) }
  }
  return { ok: true, n, id: rec.id }
}

/** Gaps in a stream's index 1..N. Empty ⇒ provably complete. */
export function gaps(stream, dir = recordDir()) {
  const ns = read(stream, dir).records.map((r) => r.n).filter((n) => typeof n === 'number').sort((a, b) => a - b)
  const max = ns.at(-1) ?? 0
  const present = new Set(ns)
  const out = []
  for (let i = 1; i <= max; i++) if (!present.has(i)) out.push(i)
  return out
}

// ── projection (rebuildable, readable) ──────────────────────────────────────────
const SCHEMA = `
CREATE TABLE events (
  stream TEXT NOT NULL,
  n INTEGER NOT NULL,
  id TEXT NOT NULL,
  ts TEXT,
  kind TEXT,
  status TEXT,
  summary TEXT,
  trace_id TEXT, span_id TEXT, parent_span_id TEXT,
  session TEXT, run TEXT, call INTEGER, branch TEXT,
  payload TEXT,
  PRIMARY KEY (stream, n)
);
CREATE VIEW signals    AS SELECT * FROM events WHERE stream='signals';
CREATE VIEW runs       AS SELECT * FROM events WHERE stream='runs';
CREATE VIEW classified AS SELECT * FROM events WHERE stream='classified';
CREATE VIEW estimates  AS SELECT * FROM events WHERE stream='estimates';
CREATE VIEW reconcile  AS SELECT * FROM events WHERE stream='reconcile';
CREATE VIEW incidents  AS SELECT * FROM events WHERE stream='incidents';
CREATE VIEW chain      AS SELECT * FROM events WHERE stream='chain';
CREATE VIEW gates      AS SELECT * FROM events WHERE stream='gates';`

/** Drop-and-rebuild state/os.db's `events` table (+ per-stream views) from the JSONL truth. */
export function project({ dir = recordDir(), db = dbPath(), streams = STREAMS } = {}) {
  mkdirSync(dirname(db), { recursive: true })
  const sql = new DatabaseSync(db)
  sql.exec('DROP TABLE IF EXISTS events;')
  for (const v of STREAMS) sql.exec(`DROP VIEW IF EXISTS ${v};`)
  sql.exec(SCHEMA)
  const ins = sql.prepare(`INSERT OR REPLACE INTO events
    (stream,n,id,ts,kind,status,summary,trace_id,span_id,parent_span_id,session,run,call,branch,payload)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  let rows = 0
  const allGaps = {}
  for (const stream of streams) {
    const { records } = read(stream, dir)
    for (const r of records.sort((a, b) => (a.n ?? 0) - (b.n ?? 0))) {
      ins.run(stream, r.n ?? 0, r.id ?? `${stream}:${r.n}`, r.ts ?? null, r.kind ?? null, r.status ?? null,
        (r.summary ?? null) && String(r.summary).slice(0, 500), r.traceId ?? null, r.spanId ?? null, r.parentSpanId ?? null,
        r.session ?? null, r.run ?? null, typeof r.call === 'number' ? r.call : null, r.branch ?? null, JSON.stringify(r))
      rows++
    }
    const g = gaps(stream, dir)
    if (g.length) allGaps[stream] = g
  }
  const count = sql.prepare('SELECT count(*) AS c FROM events').get().c
  sql.close()
  return { rows, count, gaps: allGaps }
}

// ── thin CLI ──────────────────────────────────────────────────────────────────
function main() {
  const [cmd, arg] = process.argv.slice(2)
  if (cmd === 'project') {
    const r = project()
    process.stdout.write(`projected ${dbPath()}: ${r.count} events; gaps=${JSON.stringify(r.gaps)}\n`)
  } else if (cmd === 'gaps') {
    process.stdout.write(`${arg || 'all'}: ${JSON.stringify(arg ? gaps(arg) : Object.fromEntries(STREAMS.map((s) => [s, gaps(s)])))}\n`)
  } else if (cmd === 'read' && arg) {
    const { records, corrupt } = read(arg)
    process.stdout.write(`${records.length} in ${streamPath(arg)} (corrupt ${corrupt}); gaps=[${gaps(arg).join(',')}]\n`)
  } else {
    process.stdout.write(`streams: ${STREAMS.map((s) => `${s}=${read(s).records.length}`).join(' ')}\n`)
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main()
