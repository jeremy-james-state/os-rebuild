import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import { runGovernanceCheck, checkDeclaredWorkflows, checkArchitectureVersion, checkNoConflictMarkers } from './governance-check.mjs'

function tmpRoot() { return mkdtempSync(join(tmpdir(), 'governance-check-')) }

function write(root, file, content) {
  const abs = join(root, file)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function makeCleanRepo(root) {
  write(root, 'record/governance-ledger.jsonl', [
    '{"id":"gov-1","ts":"2026-06-30","change":"seed","scope":"governance","basis":"test","decidedBy":"tester","decision":"approved"}',
  ].join('\n'))
  write(root, 'governance/permissions.json', JSON.stringify({
    writeZones: [
      { owner: 'architect', writes: ['governance/decisions/'] },
      { owner: 'ov', writes: ['governance/rules/'] },
    ],
  }, null, 2))
  write(root, 'governance/decisions/README.md', '# decisions\n')
  write(root, 'governance/rules/README.md', '# rules\n')
  write(root, 'governance/decisions/decision-a.md', '# Decision A\n\nSee [Rule A](../rules/rule-a.md).\n')
  write(root, 'governance/rules/rule-a.md', '# Rule A\n')
  write(root, 'docs/README.md', [
    '# docs',
    '',
    '- governance/decisions/decision-a.md',
    '- governance/rules/rule-a.md',
  ].join('\n'))
  write(root, 'docs/BOUNDARY.md', '# boundary\n')
  write(root, 'governance/architecture.json', JSON.stringify({
    architectureVersion: '1.0', boundary: 'docs/BOUNDARY.md',
    history: [{ version: '1.0', date: '2026-07-01', change: 'seed' }],
  }, null, 2))
}

test('runGovernanceCheck: clean governance repo passes', () => {
  const root = tmpRoot()
  try {
    makeCleanRepo(root)
    assert.deepEqual(runGovernanceCheck({ root }).findings, [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('checkArchitectureVersion: missing file + version/history mismatch are ERROR; clean is []', () => {
  const root = tmpRoot()
  try {
    assert.ok(checkArchitectureVersion(root).some((f) => f.code === 'architecture-missing'))
    write(root, 'docs/BOUNDARY.md', '# b\n')
    write(root, 'governance/architecture.json', JSON.stringify({
      architectureVersion: '2.0', boundary: 'docs/BOUNDARY.md', history: [{ version: '1.0' }],
    }))
    assert.deepEqual(checkArchitectureVersion(root).map((f) => f.code), ['architecture-version-mismatch'])
    write(root, 'governance/architecture.json', JSON.stringify({
      architectureVersion: '1.0', boundary: 'docs/BOUNDARY.md', history: [{ version: '1.0' }],
    }))
    assert.deepEqual(checkArchitectureVersion(root), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('runGovernanceCheck: malformed ledger line is an ERROR', () => {
  const root = tmpRoot()
  try {
    makeCleanRepo(root)
    write(root, 'record/governance-ledger.jsonl', [
      '{"id":"gov-1","ts":"2026-06-30","change":"seed","scope":"governance","basis":"test","decidedBy":"tester","decision":"approved"}',
      '{"id":"gov-2"',
    ].join('\n'))
    const findings = runGovernanceCheck({ root }).findings
    assert.ok(findings.some((f) => f.severity === 'ERROR' && f.code === 'ledger-invalid-json'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('runGovernanceCheck: a missing ledger is OK (record/ is gitignored, Data-Layer-backed)', () => {
  const root = tmpRoot()
  try {
    makeCleanRepo(root)
    rmSync(join(root, 'record/governance-ledger.jsonl'))
    const findings = runGovernanceCheck({ root }).findings
    assert.ok(!findings.some((f) => f.code === 'ledger-unreadable'),
      'a missing ledger must not be reported as drift')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('runGovernanceCheck: dangling cross-reference is an ERROR', () => {
  const root = tmpRoot()
  try {
    makeCleanRepo(root)
    write(root, 'governance/decisions/decision-a.md', '# Decision A\n\nSee [Missing rule](../rules/missing-rule.md).\n')
    const findings = runGovernanceCheck({ root }).findings
    assert.ok(findings.some((f) => f.severity === 'ERROR' && f.code === 'governance-link-dangling'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('runGovernanceCheck: the real repo has zero governance ERRORs', () => {
  const errors = runGovernanceCheck().findings.filter((f) => f.severity === 'ERROR')
  assert.deepEqual(errors, [], `expected zero governance errors, got: ${JSON.stringify(errors, null, 2)}`)
})

test('checkNoConflictMarkers: markers → ERROR; clean file & markdown ======= divider → none', () => {
  const root = tmpRoot()
  try {
    execFileSync('git', ['-C', root, 'init', '-q'])
    write(root, 'conflicted.mjs', [
      'const a = 1',
      '<<<<<<< HEAD',
      'const b = 2',
      '=======',
      'const b = 3',
      '>>>>>>> other',
    ].join('\n') + '\n')
    write(root, 'clean.mjs', 'const ok = true\n')
    // a markdown horizontal-ish divider using ======= alone must NOT trip the check
    write(root, 'doc.md', '# Title\n\nSection\n=======\n\nBody\n')
    execFileSync('git', ['-C', root, 'add', '-A'])
    const findings = checkNoConflictMarkers(root)
    assert.equal(findings.length, 1)
    assert.equal(findings[0].severity, 'ERROR')
    assert.equal(findings[0].code, 'conflict-marker')
    assert.match(findings[0].message, /conflicted\.mjs/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkNoConflictMarkers: non-git dir → [] (fail-open)', () => {
  const root = tmpRoot()
  try {
    write(root, 'conflicted.mjs', '<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> other\n')
    assert.deepEqual(checkNoConflictMarkers(root), []) // no git → nothing tracked → fail-open
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkDeclaredWorkflows: no workflows dir is a no-op', () => {
  const root = tmpRoot()
  try {
    assert.deepEqual(checkDeclaredWorkflows(root), [])
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkDeclaredWorkflows: an undeclared workflow is an ERROR', () => {
  const root = tmpRoot()
  try {
    write(root, '.github/workflows/ci.yml', 'name: CI\n')
    write(root, '.github/workflows/rogue.yml', 'name: Rogue\n')
    write(root, 'governance/environment.json', JSON.stringify({
      layers: { L3_repo: { controls: [{ id: 'ci', path: '.github/workflows/ci.yml' }] } },
    }))
    const findings = checkDeclaredWorkflows(root)
    assert.equal(findings.length, 1)
    assert.equal(findings[0].severity, 'ERROR')
    assert.equal(findings[0].code, 'workflow-undeclared')
    assert.match(findings[0].message, /rogue\.yml/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('checkDeclaredWorkflows: all declared → clean; declared-but-absent → WARN', () => {
  const root = tmpRoot()
  try {
    write(root, '.github/workflows/ci.yml', 'name: CI\n')
    write(root, 'governance/environment.json', JSON.stringify({
      layers: { L3_repo: { controls: [
        { id: 'ci', path: '.github/workflows/ci.yml' },
        { id: 'ghost', path: '.github/workflows/ghost.yml' },
      ] } },
    }))
    const findings = checkDeclaredWorkflows(root)
    assert.equal(findings.filter((f) => f.severity === 'ERROR').length, 0)
    const warns = findings.filter((f) => f.severity === 'WARN')
    assert.equal(warns.length, 1)
    assert.match(warns[0].message, /ghost\.yml/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
