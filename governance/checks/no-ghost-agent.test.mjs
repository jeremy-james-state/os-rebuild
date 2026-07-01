import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTarget, checkNoGhostAgents, runNoGhostAgent } from './no-ghost-agent.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test("'unknown' is the honest escape — always resolves", () => {
  assert.equal(resolveTarget(ROOT, 'unknown').resolved, true)
})

test('a real kernel candidate (orchestrator) resolves', () => {
  const r = resolveTarget(ROOT, 'orchestrator')
  assert.equal(r.resolved, true)
  assert.equal(r.via, 'harness/loop')
})

test('a fabricated agent does NOT resolve (it is a ghost)', () => {
  assert.equal(resolveTarget(ROOT, 'totally-made-up-agent').resolved, false)
})

test('checkNoGhostAgents flags a ghost target as ERROR', () => {
  const { findings } = checkNoGhostAgents({ root: ROOT, targets: ['totally-made-up-agent'] })
  assert.equal(findings.length, 1)
  assert.equal(findings[0].severity, 'ERROR')
  assert.equal(findings[0].code, 'ghost-agent')
})

test('checkNoGhostAgents passes for real targets', () => {
  const { findings } = checkNoGhostAgents({
    root: ROOT,
    targets: ['unknown', 'orchestrator', 'doctor'],
    handlerTargets: new Set(['doctor']),
  })
  assert.deepEqual(findings, [])
})

test('the real repo has no ghost agents (every live target resolves)', async () => {
  const { findings } = await runNoGhostAgent({ root: ROOT })
  const errs = findings.filter((f) => f.severity === 'ERROR')
  assert.deepEqual(errs, [], `ghosts: ${JSON.stringify(errs)}`)
})
