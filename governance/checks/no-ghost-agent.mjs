#!/usr/bin/env node
// governance/checks/no-ghost-agent.mjs — the no-ghost-agent check (fail-closed).
//
// "It must be impossible to reference an agent that isn't really there." Every target the
// loop can route to MUST resolve to something real:
//   • a live handler in the orchestrator's dispatch table, or
//   • a sandbox candidate with a co-located contract.json, or
//   • a declared component in the manifest census (harness/manifest.json), or
//   • a check script (governance/checks/<target>.mjs), or
//   • the literal 'unknown' — the honest escape the classifier uses when it won't guess.
//
// Anything else is a GHOST: a name the system pretends it can call. That is an ERROR.
// This is the static (gate-time) half of the guarantee; the orchestrator enforces the
// runtime half by routing an unrecognised target to 'unknown' instead of faking a call.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..', '..')

const finding = (severity, code, message, fix = '') => ({ severity, code, message, fix })

function registryIds(root) {
  try {
    const man = JSON.parse(readFileSync(join(root, 'harness/manifest.json'), 'utf8'))
    return new Set((man.components || []).map((c) => c.id))
  } catch { return new Set() }
}

/** How (if at all) a target name resolves to something real. */
export function resolveTarget(root, target, { handlerTargets = new Set() } = {}) {
  if (target === 'unknown') return { resolved: true, via: 'escape' }
  if (handlerTargets.has(target)) return { resolved: true, via: 'handler' }
  for (const zone of ['apps/_drafts', 'harness/loop', 'harness/guard', 'apps']) {
    if (existsSync(join(root, zone, target, 'contract.json'))) return { resolved: true, via: zone }
  }
  if (existsSync(join(root, 'governance/checks', `${target}.mjs`))) return { resolved: true, via: 'enforcement' }
  if (registryIds(root).has(target)) return { resolved: true, via: 'registry' }
  return { resolved: false, via: null }
}

/**
 * Check a set of routing targets against reality. Returns { findings }.
 * Unresolvable target → ERROR 'ghost-agent'.
 */
export function checkNoGhostAgents({ root = DEFAULT_ROOT, targets, handlerTargets } = {}) {
  const findings = []
  const seen = new Set(targets)
  for (const t of seen) {
    const r = resolveTarget(root, t, { handlerTargets })
    if (!r.resolved) {
      findings.push(finding('ERROR', 'ghost-agent',
        `Routing target '${t}' resolves to nothing real (no handler, contract in apps/_drafts|apps|harness/loop|harness/guard, manifest row, or check script).`,
        `Build '${t}' as a candidate with a contract.json (apps/_drafts/), declare it in the manifest census, or route it to 'unknown'.`))
    }
  }
  return { findings }
}

/**
 * Derive the live targets from the actual classifier rules + orchestrator
 * handlers, then check them.
 *
 * Hardened at os-reshape P1 (fail-LOUD): an import that throws, or a derived
 * target set that is EMPTY, is an ERROR — not a silent vacuous pass. Before
 * this, moving/breaking the classifier made the check pass with zero targets,
 * which is exactly the blindness it exists to prevent.
 */
export async function runNoGhostAgent({ root = DEFAULT_ROOT } = {}) {
  const preFindings = []
  let targets = []
  let handlerTargets = new Set()
  try {
    const { RULES } = await import(pathToFileURL(join(root, 'harness/loop/classifier/index.mjs')).href)
    targets.push(...RULES.map((r) => r.target))
  } catch (e) {
    preFindings.push(finding('ERROR', 'ghost-check-import-failed',
      `Cannot import the classifier (harness/loop/classifier/index.mjs): ${e.message}`,
      'Fix the classifier path/module — a check that cannot see the routing rules cannot certify them.'))
  }
  try {
    const { HANDLERS } = await import(pathToFileURL(join(root, 'harness/loop/orchestrator/index.mjs')).href)
    handlerTargets = new Set(Object.keys(HANDLERS))
    targets.push(...handlerTargets)
  } catch (e) {
    preFindings.push(finding('ERROR', 'ghost-check-import-failed',
      `Cannot import the orchestrator (harness/loop/orchestrator/index.mjs): ${e.message}`,
      'Fix the orchestrator path/module — a check that cannot see the dispatch table cannot certify it.'))
  }
  if (!preFindings.length && targets.length === 0) {
    preFindings.push(finding('ERROR', 'ghost-check-zero-targets',
      'Derived ZERO routing targets — the classifier/orchestrator surfaces are empty or invisible.',
      'A live loop always has targets; zero means this check is blind. Fix the derivation before trusting it.'))
  }
  const res = checkNoGhostAgents({ root, targets, handlerTargets })
  return { findings: [...preFindings, ...res.findings] }
}

function print({ findings }) {
  const errs = findings.filter((f) => f.severity === 'ERROR')
  process.stdout.write('\nno-ghost-agent check\n')
  process.stdout.write(`  errors: ${errs.length}\n\n`)
  for (const f of findings) {
    process.stdout.write(`  [${f.severity}] ${f.code}: ${f.message}\n`)
    if (f.fix) process.stdout.write(`           fix: ${f.fix}\n`)
  }
  process.stdout.write(errs.length ? '\nRESULT: GHOST (fail-closed)\n' : 'RESULT: OK (no ghost agents)\n')
  return errs.length ? 1 : 0
}

async function main() {
  const res = await runNoGhostAgent()
  if (process.argv.includes('--json')) { process.stdout.write(JSON.stringify(res, null, 2) + '\n'); process.exitCode = res.findings.some((f) => f.severity === 'ERROR') ? 1 : 0 }
  else process.exitCode = print(res)
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
