#!/usr/bin/env node
/**
 * loop-store — CANDIDATE (pre-admission; see governance/rules/harness-admission.md), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * The data layer for the signal loop. Two representations, one truth:
 *
 *   • record/<stream>.jsonl  — append-only TRUTH (one stream per loop store: signals,
 *                              runs, classified, estimates, reconcile, incidents, chain, gates)
 *   • state/os.db (table `events`) — the READABLE projection (one row per event,
 *                              rebuildable from the JSONL, gitignored)
 *
 * Truth-first: the durable JSONL is appended BEFORE the projection. The per-stream index
 * `n` is gapless 1..N so completeness is provable. A failed write is recorded to
 * state/loop-store-drops.jsonl — nothing fails silently. Generalised from v2's
 * signal-ledger/ledger.mjs. Zero-dependency (Node 22+ built-ins).
 *
 * Concurrency: `append` serialises the read-n-then-write critical section with an O_EXCL
 * lockfile (per stream), so concurrent writers cannot assign a duplicate `n`. The sole-writer
 * rule remains the intended topology; the lock makes a violation safe rather than corrupting.
 */
import { realpathSync,
  appendFileSync, mkdirSync, readFileSync, existsSync, openSync, closeSync, unlinkSync,
  statSync, fstatSync, writeSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const HERE = dirname(fileURLToPath(import.meta.url))
// Boot-root indirection (os-reshape P2): OS_ROOT pins the runtime root explicitly
// (launcher/sealed boots); default stays the file-relative derivation, which inside
// a sealed snapshot resolves to the snapshot root — self-contained either way.
export const REPO_ROOT = process.env.OS_ROOT ? resolve(process.env.OS_ROOT) : resolve(HERE, '..', '..', '..')

/** The loop's streams. Each is a sole-writer append-only log. governance-ledger is NOT here. */
export const STREAMS = ['signals', 'runs', 'classified', 'estimates', 'reconcile', 'incidents', 'chain', 'gates', 'releases']

export function recordDir() { return process.env.OS_RECORD_DIR || join(REPO_ROOT, 'record') }
export function streamPath(stream, dir = recordDir()) { return join(dir, `${stream}.jsonl`) }
export function dbPath() { return process.env.OS_DB || join(REPO_ROOT, 'state/os.db') }
export function dropPath() { return process.env.OS_DROPS || join(REPO_ROOT, 'state/loop-store-drops.jsonl') }

const nowIso = () => new Date().toISOString()

// ── single-writer lock (O_EXCL lockfile + bounded synchronous spin) ─────────────
// P3 hardening (os-reshape): a lock held by a LIVE holder is NEVER stolen. The old
// code force-broke ANY lock after ~1s of spinning — two writers in the critical
// section → duplicate n, silently (reproduced by rig eval X2b). Now: a dead-pid or
// stale lock (mtime past liveTtlMs) may be broken; a live one is waited on up to
// budgetMs, then the write FAILS CLOSED with a loud drop record (never silent loss).
const LOCK_HELD = Symbol('lock-held-by-live-writer')
function pidAlive(pid) { try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } }
function sleepMs(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) } catch { /* no SAB → no wait */ } }
function lockVerdict(path, liveTtlMs) {
  // {gone:true} | {live:true} | {stale:true} — judged from the file at `path`
  let st
  try { st = statSync(path) } catch { return { gone: true } }
  let meta = null
  try { meta = JSON.parse(readFileSync(path, 'utf8')) } catch { /* empty/legacy lock — age decides */ }
  const pidDead = meta && typeof meta.pid === 'number' ? !pidAlive(meta.pid) : false
  return (!pidDead && (Date.now() - st.mtimeMs) < liveTtlMs) ? { live: true } : { stale: true }
}
function withLock(lockPath, fn, { waitMs = 5, liveTtlMs = 30000, budgetMs = 10000 } = {}) {
  mkdirSync(dirname(lockPath), { recursive: true })
  const deadline = Date.now() + budgetMs
  let fd, myIno
  while (fd === undefined) {
    try {
      fd = openSync(lockPath, 'wx')
      myIno = fstatSync(fd).ino
      // metadata through the FD — never a reopen-by-path (that raced)
      try { writeSync(fd, JSON.stringify({ pid: process.pid, ts: nowIso() })) } catch { /* mtime still guards */ }
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      const v = lockVerdict(lockPath, liveTtlMs)
      if (v.gone) continue // vanished mid-look → just retry; NEVER unlink by path blind (deletes a new holder's lock — reproduced dup race)
      if (v.live) {
        if (Date.now() >= deadline) return LOCK_HELD // fail CLOSED — caller records the drop
        sleepMs(waitMs)
        continue
      }
      // stale/dead → CLAIM-then-break: atomically move it aside so only one
      // breaker acts, then re-verify what we actually claimed.
      const claim = `${lockPath}.claim-${process.pid}`
      try { renameSync(lockPath, claim) } catch { continue } // someone else claimed/released → retry
      const cv = lockVerdict(claim, liveTtlMs)
      if (cv.live) { try { renameSync(claim, lockPath) } catch { try { unlinkSync(claim) } catch { /* gone */ } } }
      else { try { unlinkSync(claim) } catch { /* gone */ } }
      continue
    }
  }
  try { return fn() } finally {
    try { closeSync(fd) } catch { /* already closed */ }
    // release ONLY our own lock: the file at lockPath may belong to someone
    // else by now — match inodes before unlinking.
    try { if (statSync(lockPath).ino === myIno) unlinkSync(lockPath) } catch { /* already gone */ }
  }
}
// ── truth I/O ─────────────────────────────────────────────────────────────────
/** Read a stream. Never throws: an unreadable file degrades to {records:[], corrupt:-1, unreadable:true}. */
export function read(stream, dir = recordDir()) {
  const path = streamPath(stream, dir)
  if (!existsSync(path)) return { records: [], corrupt: 0 }
  let text
  try { text = readFileSync(path, 'utf8') }
  catch { return { records: [], corrupt: -1, unreadable: true } } // EISDIR / EACCES / etc.
  let records = [], corrupt = 0
  for (const line of text.split('\n').filter(Boolean)) {
    try { records.push(JSON.parse(line)) } catch { corrupt++ }
  }
  return { records, corrupt }
}

export function nextIndex(stream, dir = recordDir()) {
  const ns = read(stream, dir).records.map((r) => r.n).filter((n) => typeof n === 'number')
  return ns.reduce((m, v) => (v > m ? v : m), 0) + 1 // reduce, not Math.max(...spread) — no stack-arg cliff
}

function recordDrop(entry, drops = dropPath()) {
  try { mkdirSync(dirname(drops), { recursive: true }); appendFileSync(drops, `${JSON.stringify({ ts: nowIso(), ...entry })}\n`) }
  catch { /* drop marker is best-effort; duplicates()/gaps() also detect via the index */ }
}

/**
 * Append one event to a stream's truth log. Assigns a gapless `n` and an id `<stream>:<n>`.
 * Returns { ok, n, id } on success or { ok:false, dropped:true, n, id, reason } on failure —
 * a STABLE id is returned even on a drop so downstream linkage never references `undefined`.
 * The read-n-then-write is serialised by a per-stream lock so concurrent writers don't collide.
 */
export function append(stream, row = {}, { dir = recordDir(), drops = dropPath(), now = nowIso } = {}) {
  if (!STREAMS.includes(stream)) throw new Error(`unknown stream '${stream}' (known: ${STREAMS.join(', ')})`)
  const path = streamPath(stream, dir)
  const res = withLock(`${path}.lock`, () => {
    const n = nextIndex(stream, dir)
    const rec = { n, id: `${stream}:${n}`, ts: row.ts || now(), stream, ...row }
    try {
      mkdirSync(dirname(path), { recursive: true })
      appendFileSync(path, `${JSON.stringify(rec)}\n`)
    } catch (e) {
      recordDrop({ stage: 'append', stream, n, reason: String(e?.message || e), record: rec }, drops)
      return { ok: false, dropped: true, n, id: rec.id, reason: String(e?.message || e) }
    }
    return { ok: true, n, id: rec.id }
  })
  if (res === LOCK_HELD) {
    // fail-closed-with-drop-record: the row is NOT silently lost — it lands in
    // the drops file (durable, loud) and the caller sees ok:false.
    recordDrop({ stage: 'lock-held', stream, reason: 'single-writer lock held by a live writer past the wait budget — write refused (fail-closed)', record: row }, drops)
    return { ok: false, dropped: true, n: null, id: null, reason: 'lock-held-by-live-writer' }
  }
  return res
}

// ── completeness ────────────────────────────────────────────────────────────────
/** Missing indices in 1..max. */
export function gaps(stream, dir = recordDir()) {
  const ns = read(stream, dir).records.map((r) => r.n).filter((n) => typeof n === 'number').sort((a, b) => a - b)
  const max = ns.at(-1) ?? 0
  const present = new Set(ns)
  const out = []
  for (let i = 1; i <= max; i++) if (!present.has(i)) out.push(i)
  return out
}

/** Indices that appear more than once (the concurrent-append failure mode gaps() is blind to). */
export function duplicates(stream, dir = recordDir()) {
  const seen = new Map()
  for (const r of read(stream, dir).records) if (typeof r.n === 'number') seen.set(r.n, (seen.get(r.n) || 0) + 1)
  return [...seen.entries()].filter(([, c]) => c > 1).map(([n]) => n).sort((a, b) => a - b)
}

/** Full completeness verdict: complete ⇔ no gaps AND no duplicates AND count === N. */
export function completeness(stream, dir = recordDir()) {
  const g = gaps(stream, dir), d = duplicates(stream, dir)
  const count = read(stream, dir).records.filter((r) => typeof r.n === 'number').length
  return { complete: g.length === 0 && d.length === 0, gaps: g, duplicates: d, count }
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
  type TEXT, confidence TEXT, target TEXT, score INTEGER, band TEXT, signal TEXT,
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
CREATE VIEW gates      AS SELECT * FROM events WHERE stream='gates';
CREATE VIEW releases   AS SELECT * FROM events WHERE stream='releases';
-- one readable row per command: the whole journey through the loop, joined by trace_id
CREATE VIEW loop AS
  SELECT s.ts, s.trace_id, s.summary,
         c.type, c.confidence, e.score, e.band,
         r.target, r.status
  FROM events s
  LEFT JOIN events c ON c.stream='classified' AND c.trace_id=s.trace_id
  LEFT JOIN events e ON e.stream='estimates'  AND e.trace_id=s.trace_id
  LEFT JOIN events r ON r.stream='runs'        AND r.trace_id=s.trace_id
  WHERE s.stream='signals'
  ORDER BY s.n;`

/**
 * Drop-and-rebuild state/os.db's `events` table (+ per-stream views) from the JSONL truth.
 * Returns { rows (read), count (projected), lost (rows-count), gaps, duplicates }. `lost > 0`
 * means duplicate-n collapsed rows — surfaced, not swallowed.
 */
export function project({ dir = recordDir(), db = dbPath(), streams = STREAMS } = {}) {
  mkdirSync(dirname(db), { recursive: true })
  const sql = new DatabaseSync(db)
  sql.exec('DROP VIEW IF EXISTS loop;')
  for (const v of STREAMS) sql.exec(`DROP VIEW IF EXISTS ${v};`)
  sql.exec('DROP TABLE IF EXISTS events;')
  sql.exec(SCHEMA)
  const ins = sql.prepare(`INSERT OR REPLACE INTO events
    (stream,n,id,ts,kind,status,summary,type,confidence,target,score,band,signal,trace_id,span_id,parent_span_id,session,run,call,branch,payload)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  let rows = 0
  const allGaps = {}, allDups = {}
  for (const stream of streams) {
    const { records } = read(stream, dir)
    for (const r of records.sort((a, b) => (a.n ?? 0) - (b.n ?? 0))) {
      const summary = r.summary == null ? null : String(r.summary).slice(0, 500) // explicit null guard (no falsy short-circuit)
      ins.run(stream, r.n ?? 0, r.id ?? `${stream}:${r.n}`, r.ts ?? null, r.kind ?? null, r.status ?? null,
        summary, r.type ?? null, r.confidence ?? null, r.target ?? null, typeof r.score === 'number' ? r.score : null, r.band ?? null, r.signal ?? null,
        r.traceId ?? null, r.spanId ?? null, r.parentSpanId ?? null,
        r.session ?? null, r.run ?? null, typeof r.call === 'number' ? r.call : null, r.branch ?? null, JSON.stringify(r))
      rows++
    }
    const g = gaps(stream, dir); if (g.length) allGaps[stream] = g
    const d = duplicates(stream, dir); if (d.length) allDups[stream] = d
  }
  const count = sql.prepare('SELECT count(*) AS c FROM events').get().c
  sql.close()
  return { rows, count, lost: rows - count, gaps: allGaps, duplicates: allDups }
}

// ── thin CLI ──────────────────────────────────────────────────────────────────
function main() {
  const [cmd, arg] = process.argv.slice(2)
  if (cmd === 'project') {
    const r = project()
    const warn = r.lost > 0 ? `  ⚠ ${r.lost} row(s) lost to duplicate-n: ${JSON.stringify(r.duplicates)}` : ''
    process.stdout.write(`projected ${dbPath()}: ${r.count} events (read ${r.rows}); gaps=${JSON.stringify(r.gaps)}${warn}\n`)
  } else if (cmd === 'gaps') {
    process.stdout.write(`${arg || 'all'}: ${JSON.stringify(arg ? completeness(arg) : Object.fromEntries(STREAMS.map((s) => [s, completeness(s)])))}\n`)
  } else if (cmd === 'read' && arg) {
    const c = completeness(arg)
    process.stdout.write(`${c.count} in ${streamPath(arg)}; complete=${c.complete} gaps=[${c.gaps}] dups=[${c.duplicates}]\n`)
  } else {
    process.stdout.write(`streams: ${STREAMS.map((s) => `${s}=${read(s).records.length}`).join(' ')}\n`)
  }
}

/**
 * CLI main-guard, symlink-proof: node resolves import.meta.url to the REAL
 * path, while argv[1] may arrive through a symlink (.system/releases/current,
 * macOS /var, a spaced path). Comparing unresolved forms silently skips main()
 * — exit 0, no output — the exact silent-failure class caught twice in the
 * os-reshape (P0 rig, P2 sealed boot). Realpath both sides; any error → false.
 */
function cliInvoked(metaUrl) {
  try { return !!process.argv[1] && metaUrl === pathToFileURL(realpathSync(process.argv[1])).href } catch { return false }
}

if (cliInvoked(import.meta.url)) main()
