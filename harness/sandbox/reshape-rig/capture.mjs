#!/usr/bin/env node
/**
 * reshape-rig/capture.mjs — golden-master capture + compare (evals F5 + the
 * behavioural-equivalence gate of the os-reshape plan).
 *
 *   node capture.mjs --write   capture the golden master from the CURRENT tree
 *                              → golden-master.json (commit it; captured on the
 *                              pre-reshape tree, it pins today's behaviour)
 *   node capture.mjs --check   re-run the same evals and diff against the file;
 *                              exit 1 on ANY divergence (this IS eval F5)
 *
 * What is captured: the normalized F1/F2/F3/F4 outputs + the four checks'
 * status + sorted ERROR/WARN codes (G1). Normalization masks only volatility
 * (rig.mjs normalize()); everything else must match byte-for-byte.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { REPO, evalF1, evalF2, evalF3, evalF4, evalG1 } from './rig.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GOLDEN = join(HERE, 'golden-master.json')

function captureEntries() {
  const f1 = evalF1(); const f2 = evalF2(); const f3 = evalF3(); const f4 = evalF4(); const g1 = evalG1()
  for (const e of [f1, f2, f4]) if (e.recordDir) rmSync(e.recordDir, { recursive: true, force: true })
  for (const e of [f1, f2, f3, f4, g1]) {
    if (!e.pass) {
      process.stderr.write(`capture: eval ${e.id} FAILED on the current tree — refusing to capture a broken golden master.\n  ${e.detail}\n`)
      process.exit(2)
    }
  }
  // entries are COMPARED byte-for-byte (normalized); info is provenance only
  // (WARN-code sets — governance surface P1 legitimately evolves).
  return { entries: { F1: f1.golden, F2: f2.golden, F3: f3.golden, F4: f4.golden, G1: g1.golden }, info: { G1warns: g1.info } }
}

function diffObjects(a, b, path = '') {
  const out = []
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) { out.push(`${path}: type ${typeof a} → ${typeof b}`); return out }
  if (a === null || b === null || typeof a !== 'object') {
    if (a !== b) {
      const s = (v) => String(v).length > 220 ? `${String(v).slice(0, 220)}…` : String(v)
      out.push(`${path}: ${s(a)}\n   → ${s(b)}`)
    }
    return out
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  for (const k of keys) out.push(...diffObjects(a?.[k], b?.[k], path ? `${path}.${k}` : k))
  return out
}

const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : null
if (!mode) { process.stderr.write('usage: capture.mjs --write | --check\n'); process.exit(2) }

const { entries, info } = captureEntries()

if (mode === 'write') {
  let head = 'unknown'
  try { head = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { /* no git */ }
  writeFileSync(GOLDEN, JSON.stringify({ $comment: 'Golden master for the os-reshape behavioural-equivalence gate (F5). Captured pre-reshape; compare with capture.mjs --check. capturedAt/head/info are provenance only — NOT compared.', capturedAt: new Date().toISOString(), head, entries, info }, null, 2) + '\n')
  process.stdout.write(`golden master captured → ${GOLDEN}\n`)
} else {
  let stored
  try { stored = JSON.parse(readFileSync(GOLDEN, 'utf8')) } catch (e) {
    process.stderr.write(`capture --check: cannot read golden master: ${e.message}\n`); process.exit(1)
  }
  const diffs = diffObjects(stored.entries, entries)
  if (diffs.length) {
    process.stderr.write(`F5 GOLDEN-MASTER DIVERGENCE (${diffs.length} field(s)):\n` + diffs.map((d) => ` • ${d}`).join('\n') + '\n')
    process.exit(1)
  }
  process.stdout.write('F5 golden master: identical (normalized) ✓\n')
}
