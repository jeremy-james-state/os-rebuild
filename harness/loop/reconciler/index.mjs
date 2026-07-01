#!/usr/bin/env node
/**
 * reconciler — CANDIDATE (pre-admission; see governance/rules/harness-admission.md), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * The guarantee that nothing fails silently (docs/architecture/harness-observability.md).
 * The orchestrator should record a terminal outcome for every signal — but if a signal was
 * captured and then nothing ran (a crash, a dropped hop), it sits in LIMBO. The reconciler
 * sweeps the data layer for any signal with no terminal run and RAISES an incident. It is
 * the out-of-process backstop: routing may be best-effort, the reconciler must be reliable.
 *
 * Two kinds of limbo are caught:
 *   • 'limbo'        — a persisted signal with no terminal run.
 *   • 'dropped-write'— a capture whose signals-stream WRITE was dropped (never reached the
 *                      stream); recorded in state/loop-store-drops.jsonl. The reconciler is
 *                      authoritative over drops so a lost capture is still reconciled.
 *
 * Idempotent: a signal already covered by a run OR already raised is not re-raised. read()
 * degrades on unreadable streams, so the sweep itself does not crash on a corrupt data layer.
 *
 * Beyond limbo, the reconciler also sweeps for git/release DRIFT (gitDrift): local state that
 * has silently diverged from what was published — unpushed commits, an active release with no
 * matching tag, and a manifest/release/tag version disagreement. Drift detection is pure
 * observability, so it fails OPEN in every direction: a git error, a missing upstream, or a
 * missing file degrades to "no drift found" — it NEVER throws or crashes the sweep.
 */
import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { read, append, dropPath } from '../loop-store/index.mjs'
import { newTrace, span, stamp, fourTuple } from '../tracer/index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..', '..', '..')

/** A real git runner bound to `root` that FAILS OPEN — any error (no repo, no upstream) → ''. */
export function realGit(root = REPO_ROOT) {
  return (args) => {
    try { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }) }
    catch { return '' }
  }
}

/** The release version tokens present as pin files in .system/releases/ (e.g. ['0.7','0.8']). Fail-open → []. */
function releaseVersions(root) {
  try {
    return readdirSync(join(root, '.system/releases'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
      .filter(Boolean)
  } catch { return [] }
}

/** The manifest's active harnessVersion. Fail-open → null. */
function manifestVersion(root) {
  try { return JSON.parse(readFileSync(join(root, 'harness/manifest.json'), 'utf8')).harnessVersion ?? null }
  catch { return null }
}

/** Compare two dotted version tokens (e.g. '0.8' vs '0.10'). null-safe; returns -1/0/1. */
function cmpVersion(a, b) {
  const pa = String(a).split('.').map((x) => parseInt(x, 10))
  const pb = String(b).split('.').map((x) => parseInt(x, 10))
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

/**
 * Detect git/release DRIFT — local state that has silently diverged from what was published.
 * Pure-ish and injectable: `git` is a function `(args:string[]) => string`. It defaults to a
 * real `execFileSync` wrapper that returns '' on ANY error, so drift detection is unit-testable
 * without a real repo AND fails OPEN by construction. Returns an array of `{ kind, message }`.
 * Any unexpected error anywhere degrades to [] (no drift) — this NEVER throws.
 */
export function gitDrift({ root = REPO_ROOT, git = realGit(root) } = {}) {
  const out = []
  try {
    // (1) unpushed-commits — local commits ahead of the tracked upstream.
    try {
      const ahead = git(['rev-list', '@{upstream}..HEAD']).trim()
      if (ahead) {
        const n = ahead.split('\n').filter(Boolean).length
        out.push({ kind: 'unpushed-commits', message: `${n} local commit(s) not pushed to @{upstream}` })
      }
    } catch { /* fail-open */ }

    // (2) release-untagged — the active release pin exists but no git tag references it.
    try {
      const hv = manifestVersion(root)
      const pinExists = hv && existsSync(join(root, `.system/releases/${hv}.json`))
      if (pinExists) {
        const tags = git(['tag', '--list']).split('\n').map((t) => t.trim()).filter(Boolean)
        const tagged = tags.some((t) => t === hv || t === `harness-v${hv}` || t.includes(hv))
        if (!tagged) out.push({ kind: 'release-untagged', message: `active release ${hv} is pinned but no git tag matches it` })
      }
    } catch { /* fail-open */ }

    // (3) version-tag-release-divergence — manifest vs newest release pin vs latest version-like tag disagree.
    //     Lenient: only flag a CLEAR disagreement; any ambiguity or missing input ⇒ no drift.
    try {
      const hv = manifestVersion(root)
      const releases = releaseVersions(root)
      const newestRelease = releases.length ? releases.slice().sort(cmpVersion).at(-1) : null
      // Latest version-like tag: strip a 'harness-v'/'v' prefix, keep only dotted-numeric tokens.
      const tagVersions = git(['tag', '--list']).split('\n')
        .map((t) => t.trim().replace(/^harness-v/, '').replace(/^v/, ''))
        .filter((t) => /^\d+(\.\d+)+$/.test(t))
      const latestTag = tagVersions.length ? tagVersions.slice().sort(cmpVersion).at(-1) : null
      // Only compare tokens we actually have; a disagreement among the present ones is drift.
      const present = [hv, newestRelease, latestTag].filter(Boolean)
      if (present.length >= 2) {
        const disagree = present.some((v) => cmpVersion(v, present[0]) !== 0)
        if (disagree) {
          out.push({
            kind: 'version-tag-release-divergence',
            message: `manifest=${hv ?? '?'} newestRelease=${newestRelease ?? '?'} latestTag=${latestTag ?? '?'} disagree`,
          })
        }
      }
    } catch { /* fail-open */ }
  } catch { /* fail-open — never throw out of gitDrift */ }
  return out
}

/** The write-lock TTL (mirrors harness-lock). A lock older than this is orphaned. */
const LOCK_TTL_MS = 2 * 60 * 60 * 1000 // 2h

/** Default pid-liveness probe (signal 0); EPERM still means alive. Unknown → false. */
function defaultPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false
  try { process.kill(pid, 0); return true } catch (e) { return e && e.code === 'EPERM' }
}

/**
 * Clear ORPHAN write-locks: scan state/harness-locks/*.lock and remove any whose lock is NOT live
 * (dead pid or ts past TTL, plus unparseable/empty files). A live lock (fresh ts + alive pid) is
 * KEPT. Injectable `now`/`pidAlive` for tests; fail-open by construction — a fs/parse error on one
 * file is swallowed and the sweep continues. Returns [component] for each lock removed.
 */
export function clearOrphanLocks({ root = REPO_ROOT, now = Date.now(), pidAlive = defaultPidAlive } = {}) {
  const cleared = []
  const dir = join(root, 'state', 'harness-locks')
  let entries = []
  try { entries = readdirSync(dir).filter((f) => f.endsWith('.lock')) } catch { return cleared }
  for (const f of entries) {
    const component = f.slice(0, -'.lock'.length)
    const p = join(dir, f)
    let lock = null
    try { lock = JSON.parse(readFileSync(p, 'utf8')) } catch { lock = null } // unparseable/empty → orphan
    let live = false
    if (lock && lock.ts) {
      const t = Date.parse(lock.ts)
      live = !Number.isNaN(t) && (now - t <= LOCK_TTL_MS) && pidAlive(lock.pid)
    }
    if (!live) {
      try { unlinkSync(p); cleared.push(component) } catch { /* fail-open: leave it for next sweep */ }
    }
  }
  return cleared
}

function readDroppedSignalIds(path) {
  if (!path || !existsSync(path)) return []
  let text
  try { text = readFileSync(path, 'utf8') } catch { return [] }
  const ids = []
  for (const line of text.split('\n').filter(Boolean)) {
    try { const d = JSON.parse(line); if (d.stage === 'append' && d.stream === 'signals' && d.record && d.record.id) ids.push(d.record.id) } catch {}
  }
  return ids
}

/**
 * Sweep for limbo signals (and dropped captures) and git/release drift, raising an incident for
 * each new one. Returns { checked, limbo: [signalId], drift: [driftKind], raised: [incidentId] }.
 * The git-drift step is fail-open and, in tmp/test mode (opts.dir set), inert unless the caller
 * opts in via opts.root or opts.git — so it never touches the live repo during isolated tests.
 */
export function sweep(opts = {}) {
  const dir = opts.dir
  const dropsPath = opts.dropsPath || dropPath()
  const now = opts.now || (() => new Date().toISOString())
  const idGen = opts.idGen || (() => randomUUID())
  const rd = (s) => read(s, dir).records
  const w = (stream, row) => append(stream, row, dir ? { dir, now } : { now })

  const signals = rd('signals')
  const incidents = rd('incidents')
  const coveredByRun = new Set(rd('runs').map((r) => r.signal).filter(Boolean))
  const raisedLimbo = new Set(incidents.filter((i) => i.cause === 'limbo' && i.signal).map((i) => i.signal))
  const raisedDrop = new Set(incidents.filter((i) => i.cause === 'dropped-write' && i.signal).map((i) => i.signal))
  // Git/release drift is deduped by its drift kind (the incident's `signal` field carries the kind).
  const raisedGitDrift = new Set(incidents.filter((i) => i.cause === 'git-drift' && i.signal).map((i) => i.signal))

  const limbo = []
  const drift = []
  const raised = []
  const clearedLocks = []
  const raise = (signalId, cause, reason, summary, bucket = limbo) => {
    const trace = newTrace({ id: idGen(), now })
    const s = span(trace, 'reconcile', { id: idGen(), now })
    const tuple = fourTuple({ session: opts.session, run: trace.traceId })
    const inc = w('incidents', stamp({ kind: 'incident', status: 'open', cause, signal: signalId, reason, summary: summary ?? null }, s, tuple))
    bucket.push(signalId)
    raised.push(inc.id)
  }

  // (1) persisted signals with no terminal run
  for (const sig of signals) {
    if (coveredByRun.has(sig.id) || raisedLimbo.has(sig.id)) continue
    raise(sig.id, 'limbo', 'signal received but no terminal outcome (limbo)', sig.summary)
  }
  // (2) captures whose signals-stream write was dropped (never reached the stream)
  for (const id of new Set(readDroppedSignalIds(dropsPath))) {
    if (raisedDrop.has(id)) continue
    raise(id, 'dropped-write', 'signal capture write was dropped — never reached the signals stream', null)
  }
  // (3) git/release drift — fully wrapped so a git error / missing file cannot crash the sweep.
  //     Each drift kind is raised once (deduped by kind via raisedGitDrift); the incident's
  //     `signal` field carries the drift kind so idempotency uses the SAME path as the raises above.
  //     Isolation: in test/tmp mode (opts.dir set) the drift step is INERT unless the caller
  //     explicitly opts in via opts.root or opts.git, so a tmp-dir sweep never touches the live
  //     repo. For a real CLI sweep (no opts.dir) it defaults to REPO_ROOT + the real git runner.
  try {
    const driftEnabled = opts.root != null || opts.git != null || !dir
    if (driftEnabled) {
      const root = opts.root || REPO_ROOT
      for (const d of gitDrift({ root, git: opts.git })) {
        if (raisedGitDrift.has(d.kind)) continue
        raisedGitDrift.add(d.kind) // guard against duplicate kinds within a single sweep too
        raise(d.kind, 'git-drift', d.message, d.kind, drift)
      }
    }
  } catch { /* fail-open — drift detection must never crash the backstop */ }

  // (4) orphan write-locks — remove any state/harness-locks/*.lock that is no longer live (dead
  //     pid or ts past TTL). Fully wrapped so a fs error cannot crash the sweep. Isolation mirrors
  //     the drift step: in test/tmp mode (opts.dir set) this is INERT unless the caller opts in via
  //     opts.root, so a tmp-dir sweep never touches the live state/harness-locks/. A real CLI sweep
  //     (no opts.dir) defaults to REPO_ROOT.
  try {
    const locksEnabled = opts.root != null || !dir
    if (locksEnabled) {
      const root = opts.root || REPO_ROOT
      for (const c of clearOrphanLocks({ root, now: opts.nowMs, pidAlive: opts.pidAlive })) clearedLocks.push(c)
    }
  } catch { /* fail-open — orphan-clear must never crash the backstop */ }

  return { checked: signals.length, limbo, drift, raised, clearedLocks }
}

// ── thin CLI ──────────────────────────────────────────────────────────────────
function main() {
  const r = sweep()
  if (!r.raised.length) process.stdout.write(`reconcile: ${r.checked} signals, 0 limbo, 0 drift — clean.\n`)
  else process.stdout.write(`reconcile: ${r.checked} signals, ${r.limbo.length} limbo, ${r.drift.length} drift → raised ${r.raised.join(', ')}\n`)
  process.exitCode = r.raised.length ? 3 : 0
}
if (import.meta.url === `file://${process.argv[1]}`) main()
