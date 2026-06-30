#!/usr/bin/env node
// harness/orchestrators/router.mjs — the minimal orchestrator (the first wired path).
//
// A signal goes in → gets classified → routed to a component → runs → a TERMINAL
// outcome (completed | unknown | failed) is appended to record/runs.jsonl with the
// four-tuple. No signal is silently dropped: no handler ⇒ 'unknown', logged.
//
// This is real wiring, not a description. The dispatch table is hard-coded here for
// now; a later wiring derives it from registry.json (which now holds the rows) +
// each component's contract.
//
// Run: node harness/orchestrators/router.mjs <type> <intent>
//   e.g. node harness/orchestrators/router.mjs check drift

import { appendFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const DOCTOR_PATH = join(ROOT, 'governance', 'enforcement', 'doctor.mjs')

// Dispatch table: `${type}:${intent}` → handler. (Later: derived from registry.json.)
const HANDLERS = {
  'check:drift': () => {
    const out = execFileSync(process.execPath, [DOCTOR_PATH, '--json'], { encoding: 'utf8', cwd: ROOT })
    const { findings } = JSON.parse(out)
    return {
      ok: findings.every(f => f.severity !== 'ERROR'),
      errors: findings.filter(f => f.severity === 'ERROR').length,
      warnings: findings.filter(f => f.severity === 'WARN').length,
    }
  },
}

function currentBranch(root) {
  try { return execFileSync('git', ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim() }
  catch { return 'unknown' }
}

// route a signal to a terminal outcome, recording the run. Pure-ish: all side-effect
// inputs (record path, clock, provenance) are injectable so it stays testable.
export function route(signal, opts = {}) {
  const recordPath = opts.recordPath || join(ROOT, 'record', 'runs.jsonl')
  const provenance = {
    session: opts.session || process.env.CLAUDE_SESSION_ID || 'cli',
    run: opts.run || randomUUID(),
    call: opts.call ?? 0,
    branch: opts.branch || currentBranch(ROOT),
  }
  const key = `${signal.type}:${signal.intent}`
  const handler = HANDLERS[key]

  let outcome
  if (!handler) {
    outcome = { status: 'unknown', reason: `no handler for '${key}'`, signal }
  } else {
    try {
      outcome = { status: 'completed', result: handler(signal), signal }
    } catch (e) {
      outcome = { status: 'failed', error: String((e && e.message) || e), signal }
    }
  }

  const row = { ts: opts.now || new Date().toISOString(), ...provenance, key, status: outcome.status, outcome }
  mkdirSync(dirname(recordPath), { recursive: true })
  appendFileSync(recordPath, JSON.stringify(row) + '\n')
  return { outcome, provenance }
}

function main() {
  const [type, intent] = process.argv.slice(2)
  if (!type || !intent) { process.stderr.write('usage: router <type> <intent>\n'); process.exit(2) }
  const { outcome, provenance } = route({ type, intent })
  process.stdout.write(JSON.stringify({ provenance, outcome }, null, 2) + '\n')
  process.exitCode = outcome.status === 'completed' ? 0 : outcome.status === 'unknown' ? 3 : 1
}
if (import.meta.url === `file://${process.argv[1]}`) main()
