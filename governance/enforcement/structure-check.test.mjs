import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { runStructureCheck } from './structure-check.mjs'

function tmpRoot() { return mkdtempSync(join(tmpdir(), 'structure-check-')) }

function makeCanonicalRoot(root) {
  for (const dir of ['harness', 'governance', 'docs', 'record', 'state', '.github', '.claude']) {
    mkdirSync(join(root, dir), { recursive: true })
  }
}

test('runStructureCheck: clean schema has no findings', () => {
  const root = tmpRoot()
  try {
    makeCanonicalRoot(root)
    assert.deepEqual(runStructureCheck({ root }).findings, [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('runStructureCheck: unexpected top-level dir emits WARN drift finding', () => {
  const root = tmpRoot()
  try {
    makeCanonicalRoot(root)
    mkdirSync(join(root, 'unexpected-tier'))
    const findings = runStructureCheck({ root }).findings
    assert.ok(findings.some((f) => f.severity === 'WARN' && f.code === 'STRUCTURE_DRIFT' && f.message.includes('unexpected-tier/')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
