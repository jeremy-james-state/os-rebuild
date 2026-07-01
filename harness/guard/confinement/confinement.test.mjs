import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { forbidden, targets, decide, decideStrict, underRepo, realpathOf, REPO } from './index.mjs'

const HOME = process.env.HOME
const sibling = join(HOME, 'Projects', 'harness', 'execution/tests/root-shape.test.mjs')
const mine = join(REPO, 'record', 'signals.jsonl')

test('forbidden: a sibling project path is blocked; own repo + system are not', () => {
  assert.equal(forbidden(sibling), true)                                 // /Projects/harness → blocked
  assert.equal(forbidden(join(HOME, 'Projects', 'OS', 'x')), true)       // /Projects/OS → blocked
  assert.equal(forbidden(mine), false)                                   // os-rebuild → allowed
  assert.equal(forbidden('/usr/bin/node'), false)                        // system → allowed
  assert.equal(forbidden(join(HOME, '.claude', 'settings.json')), false) // ~/.claude (not under Projects) → allowed
})

// Hermetic fixtures — inject an explicit home + a root under <home>/Projects/os-rebuild so
// the sibling / ../-escape / cd verdicts are deterministic on ANY OS and ANY checkout
// location. (In CI the real checkout is /home/runner/work/… — NOT under ~/Projects — so a
// test that leaned on the ambient HOME/REPO failed there; injecting home/root fixes it.)
const H = '/tmp/h'
const R = join(H, 'Projects', 'os-rebuild')
const sib = join(H, 'Projects', 'harness', 'execution/tests/root-shape.test.mjs')
const inRepo = join(R, 'record', 'signals.jsonl')

test('targets: extracts the sibling path from a Bash cd command (the screenshot case)', () => {
  const t = targets('Bash', { command: `cd ${join(H, 'Projects', 'harness')}; node --test execution/tests/root-shape.test.mjs` }, undefined, { home: H })
  assert.ok(t.some((p) => p.includes('Projects/harness')))
})

test('decide: blocks a Bash cd into the Core; allows an in-repo Read', () => {
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: `cd ${join(H, 'Projects', 'harness')} && node --test` } }, { root: R, home: H }).block, true)
  assert.equal(decide({ tool_name: 'Read', tool_input: { file_path: sib } }, { root: R, home: H }).block, true)
  assert.equal(decide({ tool_name: 'Read', tool_input: { file_path: inRepo } }, { root: R, home: H }).block, false)
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'node --test harness/loop/tracer/tracer.test.mjs' } }, { root: R, home: H }).block, false)
})

test('decide: catches a relative ../ escape into a sibling', () => {
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'cat ../harness/STATUS.md' }, cwd: R }, { root: R, home: H }).block, true)
})

test('decide: fails open on an unknown/empty payload (never wedges a session)', () => {
  assert.equal(decide({}).block, false)
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'ls' } }).block, false)
})

// ─────────────────────────────────────────────────────────────────────────────
// decideStrict — the HARDENED, dormant, fail-CLOSED allowlist tier.
// Red-team battery: every escape vector the design found (8/10 outside-writes
// escaped decide()) must now be BLOCKED; legitimate in-repo work must be ALLOWED.
// ─────────────────────────────────────────────────────────────────────────────

test('decideStrict BLOCKS every outside-REPO write vector (the escapes decide() let through)', () => {
  const W = (file_path) => ({ tool_name: 'Write', tool_input: { file_path } })
  // /tmp — decide() allowed it (outside ~/Projects); allowlist blocks it.
  assert.equal(decideStrict(W('/tmp/x')).block, true)
  // ~/ home root — decide() allowed it.
  assert.equal(decideStrict(W(join(HOME, 'x'))).block, true)
  // ~/.claude/settings.json — decide() allowed it.
  assert.equal(decideStrict(W(join(HOME, '.claude', 'settings.json'))).block, true)
  // /etc/x — system path decide() allowed.
  assert.equal(decideStrict(W('/etc/x')).block, true)
  // sibling ~/Projects/other/x — the one shape decide() DID block; still blocked here.
  assert.equal(decideStrict(W(join(HOME, 'Projects', 'other', 'x'))).block, true)
  // Edit + NotebookEdit variants of an outside path.
  assert.equal(decideStrict({ tool_name: 'Edit', tool_input: { file_path: '/tmp/y' } }).block, true)
  assert.equal(decideStrict({ tool_name: 'NotebookEdit', tool_input: { file_path: join(HOME, 'n.ipynb') } }).block, true)
})

test('decideStrict BLOCKS an mcp__* write tool targeting outside REPO (decide() ignored mcp entirely)', () => {
  // A hypothetical filesystem MCP create/write tool with a path argument pointing outside.
  assert.equal(decideStrict({ tool_name: 'mcp__fs__write_file', tool_input: { path: '/tmp/evil' } }).block, true)
  assert.equal(decideStrict({ tool_name: 'mcp__934__create_file', tool_input: { file_path: join(HOME, 'Projects', 'harness', 'x') } }).block, true)
  // In-repo mcp write → allowed.
  assert.equal(decideStrict({ tool_name: 'mcp__fs__write_file', tool_input: { path: join(REPO, 'harness', 'sandbox', 'x', 'a.txt') } }).block, false)
})

test('decideStrict BLOCKS a symlink inside REPO that points OUTSIDE (realpath defeats the lexical escape)', () => {
  const outside = mkdtempSync(join(tmpdir(), 'conf-outside-'))
  const inside = mkdtempSync(join(tmpdir(), 'conf-inside-'))
  try {
    writeFileSync(join(outside, 'secret.txt'), 'x')
    // A symlink that LEXICALLY lives under a REPO-like root but really points to `outside`.
    const link = join(inside, 'link-to-outside')
    symlinkSync(outside, link)
    // Treat `inside` as the repo root: the link is under root lexically, but realpath escapes it.
    assert.equal(underRepo(join(link, 'secret.txt'), inside), false, 'realpath must follow the symlink out of root')
    assert.equal(
      decideStrict({ tool_name: 'Write', tool_input: { file_path: join(link, 'secret.txt') } }, { root: inside }).block,
      true,
    )
    // Sanity: a real file directly under root is allowed.
    assert.equal(underRepo(join(inside, 'real.txt'), inside), true)
    assert.equal(
      decideStrict({ tool_name: 'Write', tool_input: { file_path: join(inside, 'real.txt') } }, { root: inside }).block,
      false,
    )
  } finally {
    rmSync(outside, { recursive: true, force: true })
    rmSync(inside, { recursive: true, force: true })
  }
})

test('decideStrict ALLOWS legitimate in-repo writes and Reads anywhere', () => {
  assert.equal(decideStrict({ tool_name: 'Write', tool_input: { file_path: join(REPO, 'harness', 'sandbox', 'x', 'index.mjs') } }).block, false)
  assert.equal(decideStrict({ tool_name: 'Edit', tool_input: { file_path: mine } }).block, false)
  // Reads are not writes → allowed even outside REPO.
  assert.equal(decideStrict({ tool_name: 'Read', tool_input: { file_path: '/etc/hosts' } }).block, false)
  assert.equal(decideStrict({ tool_name: 'Read', tool_input: { file_path: sibling } }).block, false)
  assert.equal(decideStrict({ tool_name: 'Grep', tool_input: { path: '/tmp' } }).block, false)
})

test('decideStrict ALLOWS Bash but defers it to Tier-1 (kernel sandbox), never pretending to parse it', () => {
  const r = decideStrict({ tool_name: 'Bash', tool_input: { command: `echo hi > $HOME/Projects/harness/x` } })
  assert.equal(r.block, false)
  assert.match(r.reason, /Tier-1/)
})

test('decideStrict FAILS CLOSED on a malformed/ambiguous write payload (a control blocks when uncertain)', () => {
  // Write tool with no file_path → cannot verify → block.
  assert.equal(decideStrict({ tool_name: 'Write', tool_input: {} }).block, true)
  assert.equal(decideStrict({ tool_name: 'Write' }).block, true)
  // mcp write-hinted tool with no path argument → block.
  assert.equal(decideStrict({ tool_name: 'mcp__fs__write_file', tool_input: { contents: 'x' } }).block, true)
})

test('realpathOf: expands ~ and resolves a not-yet-existing in-repo file to its lexical abs path', () => {
  assert.equal(realpathOf(join(REPO, 'harness', 'nope-does-not-exist.txt')), join(REPO, 'harness', 'nope-does-not-exist.txt'))
  assert.ok(realpathOf('~/x').startsWith(HOME))
  assert.equal(realpathOf(null), null)
})
