import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractPrompt, renderLine } from './index.mjs'
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

test('extractPrompt reads the prompt from common hook payload shapes', () => {
  assert.equal(extractPrompt({ prompt: 'a' }), 'a')
  assert.equal(extractPrompt({ user_prompt: 'b' }), 'b')
  assert.equal(extractPrompt({ summary: 'c' }), 'c')
  assert.equal(extractPrompt({}), '')
})

test('renderLine formats the trace as one visible line', () => {
  assert.equal(renderLine({ feedback: ['signal extracted (#1)', 'outcome: completed'] }),
    '🔁 OS loop  signal extracted (#1)  ·  outcome: completed')
})

test('the hook prints the live loop trace for a real command', () => {
  const out = runHook('check the harness for drift')
  assert.match(out, /🔁 OS loop/)
  assert.match(out, /classified → check \(high\) → doctor/)
  assert.match(out, /outcome: completed/)
})

test('without fail: the same command yields the same trace every time', () => {
  const strip = (s) => s.replace(/#\d+/, '#N')   // the only varying part is the per-stream index
  const a = strip(runHook('check the harness for drift'))
  const b = strip(runHook('check the harness for drift'))
  const c = strip(runHook('check the harness for drift'))
  assert.equal(a, b)
  assert.equal(b, c)
})

test('an unmatched prompt still produces a visible, honest outcome (never silent)', () => {
  const out = runHook('zzz lorem ipsum')
  assert.match(out, /🔁 OS loop/)
  assert.match(out, /outcome: unknown/)
})

test('statusLine renders the latest run — the surface the user reliably SEES', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sl-'))
  try {
    assert.match(renderStatus(dir), /idle/)  // nothing yet
    const t = 'trace-1'
    append('signals', { summary: 'check the harness for drift', traceId: t }, { dir })
    append('classified', { type: 'check', confidence: 'high', target: 'doctor', traceId: t }, { dir })
    append('estimates', { score: 61, band: 'medium', traceId: t }, { dir })
    append('runs', { status: 'completed', target: 'doctor', traceId: t }, { dir })
    const line = renderStatus(dir)
    assert.match(line, /check the harness for drift/)
    assert.match(line, /check\(high\)/)
    assert.match(line, /~61/)
    assert.match(line, /doctor/)
    assert.match(line, /completed/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
