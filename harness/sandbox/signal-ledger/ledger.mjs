#!/usr/bin/env node
/**
 * signal-ledger — CANDIDATE (harness/sandbox/), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * Every run becomes a SIGNAL, stamped with the four-tuple (session · run · call · branch)
 * and recorded in TWO places:
 *
 *   • record/signals.jsonl  — append-only TRUTH (in git; travels with the repo)
 *   • state/os.db           — rebuildable PROJECTION (gitignored; fast queries)
 *
 * Truth-first: the durable record is appended BEFORE the projection. A failed write is
 * recorded to state/signal-drops.jsonl — never silently dropped. The per-log index `n`
 * is gapless 1..N, so completeness is provable. Brought forward from v1's signal-ledger,
 * with the four-tuple v1 lacked. Zero-dependency (Node 22 built-ins).
 */
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..', '..', '..')

export function recordPath() { return process.env.SIGNAL_RECORD || join(REPO_ROOT, 'record/signals.jsonl') }
export function dropPath() { return process.env.SIGNAL_DROPS || join(REPO_ROOT, 'state/signal-drops.jsonl') }
export function dbPath() { return process.env.OS_DB || join(REPO_ROOT, 'state/os.db') }

export const signalId = (n) => `signal:${n}`

// ── four-tuple sourcing ──────────────────────────────────────────────────────
export function gitBranch(root = REPO_ROOT) {
  try { return execFileSync('git', ['-C', root, 'branch', '--show-current'], { encoding: 'utf8' }).trim() || null }
  catch { return null }
}

// Which version of the harness DEFINITION produced this row (versioning ⋅ traceability).
export function gitHead(root = REPO_ROOT) {
  try { return execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim() || null }
  catch { return null }
}

export function readHarnessVersion(root = REPO_ROOT) {
  try { return JSON.parse(readFileSync(join(root, 'harness/manifest.json'), 'utf8')).harnessVersion ?? null }
  catch { return null }
}

/** Fill the four-tuple from explicit values, then env, then git. `call` defaults to the caller. */
export function fourTuple({ session, run, call, branch } = {}) {
  const sess = session ?? process.env.CLAUDE_CODE_SESSION_ID ?? null
  return {
    session: sess,
    run: run ?? sess ?? null, // per-session today; per-tool-call once capture goes per-tool
    call: call ?? null,
    branch: branch ?? gitBranch(),
  }
}

// ── truth log I/O ────────────────────────────────────────────────────────────
export function readSignals(path = recordPath()) {
  if (!existsSync(path)) return { records: [], corrupt: 0 }
  let records = [], corrupt = 0
  for (const line of readFileSync(path, 'utf8').split('\n').filter(Boolean)) {
    try { records.push(JSON.parse(line)) } catch { corrupt++ }
  }
  return { records, corrupt }
}

export function nextIndex(path = recordPath()) {
  const ns = readSignals(path).records.map((r) => r.n).filter((n) => typeof n === 'number')
  return ns.length ? Math.max(...ns) + 1 : 1
}

function recordDrop(path, entry) {
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`)
  } catch { /* drop marker is best-effort; the sweep also detects via count mismatch */ }
}

/**
 * Append one signal to the durable truth log, stamped with the four-tuple.
 * Returns { ok, n, id } or { ok:false, dropped:true, reason } with the miss recorded.
 */
export function appendSignal({
  session, run, call, branch, source = 'unknown', summary = '',
  harnessVersion, codeSha,
  recordFile = recordPath(), dropFile = dropPath(), now = () => new Date().toISOString(),
} = {}) {
  const n = nextIndex(recordFile)
  const tuple = fourTuple({ session, run, call: call ?? n, branch })
  const rec = {
    n, op: 'create', id: signalId(n), ts: now(),
    session: tuple.session, run: tuple.run, call: tuple.call, branch: tuple.branch,
    harnessVersion: harnessVersion ?? readHarnessVersion(),
    codeSha: codeSha ?? gitHead(),
    source, summary: String(summary || '').slice(0, 500), phase: 'received',
  }
  try {
    mkdirSync(dirname(recordFile), { recursive: true })
    appendFileSync(recordFile, `${JSON.stringify(rec)}\n`)
  } catch (e) {
    recordDrop(dropFile, { stage: 'record', n, reason: String(e?.message || e), record: rec })
    return { ok: false, dropped: true, n, reason: String(e?.message || e) }
  }
  return { ok: true, n, id: rec.id }
}

// ── completeness ─────────────────────────────────────────────────────────────
/** Gaps in the per-log index 1..N. Empty ⇒ the log is provably complete. */
export function signalGaps(path = recordPath()) {
  const ns = readSignals(path).records.map((r) => r.n).filter((n) => typeof n === 'number').sort((a, b) => a - b)
  const max = ns.at(-1) ?? 0
  const present = new Set(ns)
  const gaps = []
  for (let i = 1; i <= max; i++) if (!present.has(i)) gaps.push(i)
  return gaps
}

// ── projection (rebuildable) ───────────────────────────────────────────────────
const SCHEMA = `
CREATE TABLE signals (
  n INTEGER PRIMARY KEY,
  id TEXT NOT NULL,
  ts TEXT NOT NULL,
  session TEXT, run TEXT, call INTEGER, branch TEXT,
  harness_version TEXT, code_sha TEXT,
  source TEXT, summary TEXT,
  phase TEXT NOT NULL DEFAULT 'received'
);`

/** Drop-and-rebuild state/os.db's signals table from the truth log. Idempotent. */
export function rebuildProjection({ recordFile = recordPath(), db = dbPath() } = {}) {
  mkdirSync(dirname(db), { recursive: true })
  const sql = new DatabaseSync(db)
  sql.exec('DROP TABLE IF EXISTS signals;')
  sql.exec(SCHEMA)
  const { records } = readSignals(recordFile)
  const creates = records.filter((r) => r.op === 'create').sort((a, b) => a.n - b.n)
  const ins = sql.prepare('INSERT OR REPLACE INTO signals (n,id,ts,session,run,call,branch,harness_version,code_sha,source,summary,phase) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
  for (const r of creates) {
    ins.run(r.n, r.id, r.ts ?? '', r.session ?? null, r.run ?? null, r.call ?? null, r.branch ?? null, r.harnessVersion ?? null, r.codeSha ?? null, r.source ?? null, r.summary ?? null, r.phase ?? 'received')
  }
  const rows = sql.prepare('SELECT count(*) AS c FROM signals').get().c
  sql.close()
  return { rows, gaps: signalGaps(recordFile) }
}

// ── thin CLI ───────────────────────────────────────────────────────────────────
function main() {
  const [cmd] = process.argv.slice(2)
  if (cmd === 'rebuild') {
    const r = rebuildProjection()
    process.stdout.write(`rebuilt ${dbPath()}: ${r.rows} signals, gaps=[${r.gaps.join(',')}]\n`)
  } else if (cmd === 'gaps') {
    process.stdout.write(`gaps=[${signalGaps().join(',')}]\n`)
  } else {
    const { records, corrupt } = readSignals()
    process.stdout.write(`${records.length} signals in ${recordPath()} (corrupt lines: ${corrupt}); gaps=[${signalGaps().join(',')}]\n`)
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main()
