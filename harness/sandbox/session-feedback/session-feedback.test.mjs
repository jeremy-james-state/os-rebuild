import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractPrompt, renderLine, parseCommand, decideHook } from './index.mjs'
import { renderStatus } from './statusline.mjs'
import { append } from '../loop-store/index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const HOOK = join(HERE, 'index.mjs')

function runHook(text) {
  const dir = mkdtempSync(join(tmpdir(), 'sf-'))
  try {
    return execFileSync(process.execPath, [HOOK, '--text', text],
      { encoding: 'utf8', env: { ...process.env, OS_RECORD_DIR: dir, OS_DB: join(dir, 'os.db') } }).trim()
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

// a fake loop result, so the decision logic is tested without spawning the real doctor
const fake = ({ status = 'completed', type = 'check', confidence = 'high', target = 'doctor', result = { ok: true, errors: 0, warnings: 14 } } = {}) => ({
  classification: { type, confidence, target },
  outcome: { status, result, reason: status === 'unknown' ? `no live handler for '${target}'` : undefined },
  feedback: ['signal extracted (#1)', `classified → ${type} (${confidence}) → ${target}`, 'estimated 61 (medium)', `routed → ${target}`, `outcome: ${status}`],
})
const stub = (r) => ({ run: () => r, proj: () => {} })

test('extractPrompt reads common payload shapes', () => {
  assert.equal(extractPrompt({ prompt: 'a' }), 'a'); assert.equal(extractPrompt({}), '')
})
test('renderLine formats one line', () => { assert.equal(renderLine({ feedback: ['a', 'b'] }), '🔁 OS loop  a  ·  b') })

test('parseCommand recognises the os: sigil', () => {
  assert.deepEqual(parseCommand('os: drift'), { isCommand: true, summary: 'drift' })
  assert.deepEqual(parseCommand('check the drift'), { isCommand: false, summary: 'check the drift' })
})

test('ENFORCED: an explicit command that completes at high confidence BLOCKS the model', () => {
  const d = decideHook('os: drift', stub(fake({ status: 'completed' })))
  assert.equal(d.mode, 'block')
  assert.equal(d.json.decision, 'block')
  assert.match(d.json.reason, /🔁 OS loop/)
  assert.match(d.json.reason, /doctor: 0 errors, 14 warnings/)
  assert.match(d.json.reason, /model was bypassed/)
})

test('natural language NEVER blocks — it runs the loop and STEERS via additionalContext', () => {
  const d = decideHook('check the drift please', stub(fake({ status: 'completed' })))
  assert.equal(d.mode, 'inject')
  assert.equal(d.json.hookSpecificOutput.hookEventName, 'UserPromptSubmit')
  assert.match(d.json.hookSpecificOutput.additionalContext, /OPERATING PROTOCOL/)
  assert.match(d.json.hookSpecificOutput.additionalContext, /🔁 OS loop/)
})

test('availability: an explicit command that did NOT complete falls through to the model (no block)', () => {
  const d = decideHook('os: investigate', stub(fake({ status: 'unknown', type: 'incident', target: 'investigator' })))
  assert.equal(d.mode, 'inject')                         // NOT block — never strand the user on a failed check
  assert.match(d.json.hookSpecificOutput.additionalContext, /did not complete deterministically/)
})

test('empty prompt is a noop', () => { assert.equal(decideHook('   ', stub(fake())).mode, 'noop') })

test('CLI: an os: command emits a real block decision with the real doctor result', () => {
  const j = JSON.parse(runHook('os: check the harness for drift'))
  assert.equal(j.decision, 'block')
  assert.match(j.reason, /🔁 OS loop/)
  assert.match(j.reason, /doctor: \d+ errors/)
})

test('CLI: natural language emits additionalContext (model runs, steered)', () => {
  const j = JSON.parse(runHook('what is drift in the harness'))
  assert.ok(j.hookSpecificOutput.additionalContext.includes('OPERATING PROTOCOL'))
})

test('statusLine renders the latest run — the always-visible surface', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sl-'))
  try {
    assert.match(renderStatus(dir), /idle/)
    const t = 'trace-1'
    append('signals', { summary: 'check the harness for drift', traceId: t }, { dir })
    append('classified', { type: 'check', confidence: 'high', target: 'doctor', traceId: t }, { dir })
    append('estimates', { score: 61, band: 'medium', traceId: t }, { dir })
    append('runs', { status: 'completed', target: 'doctor', traceId: t }, { dir })
    const line = renderStatus(dir)
    assert.match(line, /check the harness for drift/)
    assert.match(line, /check\(high\)/)
    assert.match(line, /completed/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
