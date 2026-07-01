#!/usr/bin/env node
/**
 * view — CANDIDATE human surface. Renders record/ into one readable HTML page so the
 * four-tuple flow is visible. Reads the truth log directly (no DB needed). Deterministic.
 *   node harness/loop/signal-ledger/view.mjs --out <file.html>
 */
import { realpathSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { REPO_ROOT, recordPath, signalGaps } from './ledger.mjs'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function jsonl(p) {
  if (!existsSync(p)) return []
  return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}
const tuple = (r) => `<span class="leg"><b>session</b> ${esc(String(r.session ?? '—'))}</span>` +
  `<span class="leg"><b>run</b> ${esc(String(r.run ?? '—').slice(0, 8))}</span>` +
  `<span class="leg"><b>call</b> ${esc(String(r.call ?? '—'))}</span>` +
  `<span class="leg"><b>branch</b> ${esc(String(r.branch ?? '—'))}</span>`

export function renderHtml(root = REPO_ROOT) {
  const signals = jsonl(recordPath())
  const runs = jsonl(join(root, 'record/runs.jsonl'))
  const gaps = signalGaps(recordPath())
  const sigRows = signals.map((s) => `<div class="row sig">
      <div class="top"><span class="time">${esc(s.ts)}</span><span class="src">${esc(s.source)}</span></div>
      <div class="sum">${esc(s.summary)}</div><div class="tuple">${tuple(s)}</div></div>`).join('\n')
  const runRows = runs.map((r) => {
    const c = { completed: '#16a34a', unknown: '#d97706', failed: '#dc2626' }[r.status] || '#64748b'
    return `<div class="row"><div class="top"><span class="time">${esc(r.ts)}</span>
      <span class="badge" style="background:${c}">${esc(r.status)}</span></div>
      <div class="sum">${esc(r.key || '')}</div><div class="tuple">${tuple(r)}</div></div>`
  }).join('\n')
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OS · Signal flow</title><style>
*{box-sizing:border-box}body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#0b0f17;color:#e5e9f0;padding:0 0 56px}
header{padding:26px 24px;background:linear-gradient(180deg,#11182a,#0b0f17);border-bottom:1px solid #1e293b}
h1{margin:0 0 6px;font-size:21px}.sub{color:#94a3b8;max-width:720px}.wrap{max-width:900px;margin:0 auto;padding:0 24px}
h2{margin:30px 0 4px;font-size:16px}.n{color:#64748b;font-size:13px;font-weight:400;margin-left:8px}
.note{color:#94a3b8;font-size:13px;margin:0 0 12px}
.row{background:#121a2b;border:1px solid #223049;border-radius:10px;padding:12px 14px;margin:9px 0}
.row.sig{border-left:3px solid #38bdf8}
.top{display:flex;justify-content:space-between;align-items:center}.time{color:#7891b5;font-size:12px;font-variant-numeric:tabular-nums}
.src{color:#7dd3fc;font-size:12px}.badge{color:#fff;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;text-transform:uppercase}
.sum{margin:8px 0 10px;color:#fde68a}.tuple{display:flex;gap:6px;flex-wrap:wrap}
.leg{display:inline-flex;gap:5px;background:#172033;border:1px solid #243049;padding:3px 8px;border-radius:6px;font-size:12px;color:#cbd5e1}
.leg b{color:#7dd3fc}.flag{padding:6px 10px;border-radius:7px;font-size:13px;margin:8px 0}
.ok{background:#0d2818;border:1px solid #16613a;color:#86efac}.bad{background:#2a1212;border:1px solid #7f1d1d;color:#fca5a5}
</style>
<header><div class="wrap"><h1>OS · Signal flow</h1>
<p class="sub">Every run becomes a four-tuple-stamped <b>signal</b> in <code>record/signals.jsonl</code> (the truth), rendered here. Candidate — not yet admitted to the harness.</p></div></header>
<div class="wrap">
  <h2>Signals <span class="n">${signals.length} captured · the four-tuple is live</span></h2>
  <div class="flag ${gaps.length ? 'bad' : 'ok'}">${gaps.length ? `⚠ completeness gap at index: ${gaps.join(', ')}` : '✓ log is provably complete (index 1..N, no gaps)'}</div>
  ${sigRows || '<p class="note">No signals yet — fire one (send a message once the hook is wired, or run intake.mjs).</p>'}
  <h2>Runs <span class="n">${runs.length} · the spine</span></h2>
  ${runRows || '<p class="note">No runs yet.</p>'}
</div>`
}

function main() {
  const i = process.argv.indexOf('--out')
  const html = renderHtml()
  if (i !== -1 && process.argv[i + 1]) { writeFileSync(process.argv[i + 1], html); process.stdout.write(`wrote ${process.argv[i + 1]}\n`) }
  else process.stdout.write(html)
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
