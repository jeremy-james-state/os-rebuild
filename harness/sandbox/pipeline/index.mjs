#!/usr/bin/env node
/**
 * pipeline — CANDIDATE (harness/sandbox/), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * The gated work chain: pre-frame → frame → scope → design → build → deploy → observe.
 * It walks the stages and STOPS at each gate awaiting a human approval — but the gate is
 * RECORDED (a 'gates' row, status 'pending'), never a live block. You approve (records an
 * 'approved' row) and re-run; it resumes from where it stopped. Event-sourced + resumable:
 * the frontier is derived from the chain/gates streams, so progress survives restarts.
 *
 * Honesty: no stage fakes a runner. Each stage records its OWNER — the (planned) component
 * that will execute it once admitted — and a 'stub' status until then. No ghost agents.
 */
import { read, append, STREAMS } from '../loop-store/index.mjs'

export const STAGES = ['pre-frame', 'frame', 'scope', 'design', 'build', 'deploy', 'observe']

/** Each stage's owning component (declared in registry.json as `planned`). */
export const OWNERS = {
  'pre-frame': 'clarify-gate', frame: 'clarifier', scope: 'scoper',
  design: 'planner', build: 'executor', deploy: 'deployer', observe: 'reconciler',
}

const SEP = '::'
const gateId = (wid, stage) => `${wid}${SEP}${stage}`

/** Event-sourced status of a work item's walk through the chain. */
export function status(wid, { dir } = {}) {
  const rd = (s) => read(s, dir).records.filter((r) => r.wid === wid)
  const done = new Set(rd('chain').map((r) => r.stage))
  const gates = rd('gates')
  const approved = new Set(gates.filter((g) => g.status === 'approved').map((g) => g.stage))
  const pending = gates.filter((g) => g.status === 'pending' && !approved.has(g.stage)).map((g) => g.stage)
  return { wid, done: [...done], approved: [...approved], pending }
}

function runStage(stage, workItem) {
  // No live runner yet — honest stub naming its owner. (When the owner is admitted, it executes here.)
  return { status: 'stub', owner: OWNERS[stage], summary: `${stage}: ${workItem.summary ?? ''}`.trim() }
}

/**
 * Advance the chain until it hits an unapproved gate (or completes). Returns
 *   { wid, status: 'awaiting-gate'|'complete', stage?, gateId? }.
 * `opts.gates` = which stages require approval (default: ALL — maximal human control).
 */
export function runChain(workItem = {}, opts = {}) {
  const dir = opts.dir
  const now = opts.now
  const wid = workItem.id || workItem.wid || 'work:1'
  const GATED = new Set(opts.gates || STAGES)
  const w = (stream, row) => append(stream, row, dir ? { dir, now } : (now ? { now } : undefined))

  const st = status(wid, { dir })
  const done = new Set(st.done)
  const approved = new Set(st.approved)

  for (const stage of STAGES) {
    if (done.has(stage)) {
      if (GATED.has(stage) && !approved.has(stage)) return { wid, status: 'awaiting-gate', stage, gateId: gateId(wid, stage) }
      continue
    }
    const r = runStage(stage, workItem)
    w('chain', { wid, stage, kind: 'chain-stage', status: r.status, owner: r.owner, summary: r.summary })
    if (GATED.has(stage)) {
      w('gates', { wid, stage, kind: 'gate', gateId: gateId(wid, stage), status: 'pending', summary: `approve ${stage}?` })
      return { wid, status: 'awaiting-gate', stage, gateId: gateId(wid, stage) }
    }
  }
  return { wid, status: 'complete' }
}

/** Record a human approval for a gate, so the next runChain resumes past it. Idempotent. */
export function approve(id, opts = {}) {
  const dir = opts.dir
  // split on the LAST separator: stage is a known single token (no '::'); wid may contain '::'
  const i = id.lastIndexOf(SEP)
  const wid = id.slice(0, i)
  const stage = id.slice(i + SEP.length)
  const already = read('gates', dir).records.some((g) => g.gateId === id && g.status === 'approved')
  if (already) return { gateId: id, status: 'approved', already: true }
  append('gates', { wid, stage, kind: 'gate', gateId: id, status: 'approved', by: opts.by || 'human', summary: `approved ${stage}` },
    dir ? { dir, now: opts.now } : (opts.now ? { now: opts.now } : undefined))
  return { gateId: id, status: 'approved', already: false }
}

// ── thin CLI ──────────────────────────────────────────────────────────────────
function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'approve' && rest[0]) { console.log(JSON.stringify(approve(rest[0]))); return }
  const summary = rest.join(' ') || 'a sample work item'
  const r = runChain({ id: 'work:demo', summary })
  console.log(JSON.stringify(r, null, 2))
  if (r.status === 'awaiting-gate') console.log(`\n→ gate pending at '${r.stage}'. Approve with:  node index.mjs approve "${r.gateId}"`)
}
if (import.meta.url === `file://${process.argv[1]}`) main()
