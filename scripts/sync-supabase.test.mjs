import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveKey } from './sync-supabase.mjs'

// Mutate OS_SUPABASE_KEY around each assertion and always restore it, so this test
// leaves the process env exactly as it found it.
function withoutEnvKey(fn) {
  const saved = process.env.OS_SUPABASE_KEY
  delete process.env.OS_SUPABASE_KEY
  try { return fn() } finally {
    if (saved === undefined) delete process.env.OS_SUPABASE_KEY
    else process.env.OS_SUPABASE_KEY = saved
  }
}
function withEnvKey(val, fn) {
  const saved = process.env.OS_SUPABASE_KEY
  process.env.OS_SUPABASE_KEY = val
  try { return fn() } finally {
    if (saved === undefined) delete process.env.OS_SUPABASE_KEY
    else process.env.OS_SUPABASE_KEY = saved
  }
}
function tmpFile(contents) {
  const dir = mkdtempSync(join(tmpdir(), 'synckey-'))
  const f = join(dir, '.supabase-key')
  writeFileSync(f, contents)
  return { f, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

// REGRESSION GUARD for the `const URL` shadow bug: `const URL` at module top shadowed the
// global URL constructor, so the key-file path was once computed via `new URL(...)` which threw
// — resolveKey caught it and returned null, silently disabling the sync. With no env key and a
// real key file, resolveKey MUST return the file's key. On the buggy version this was null.
test('resolveKey reads the injected key file when env is unset (URL-shadow regression)', () => {
  const { f, cleanup } = tmpFile('file-service-key\n')
  try {
    withoutEnvKey(() => {
      assert.equal(resolveKey({ keyFile: f }), 'file-service-key')
    })
  } finally { cleanup() }
})

test('resolveKey returns null with no env and a missing key file', () => {
  const missing = join(tmpdir(), 'synckey-does-not-exist', '.supabase-key')
  withoutEnvKey(() => {
    assert.equal(resolveKey({ keyFile: missing }), null)
  })
})

test('resolveKey returns null with no env and an empty key file', () => {
  const { f, cleanup } = tmpFile('   \n')
  try {
    withoutEnvKey(() => {
      assert.equal(resolveKey({ keyFile: f }), null)
    })
  } finally { cleanup() }
})

test('resolveKey prefers the trimmed env value over the key file (env wins)', () => {
  const { f, cleanup } = tmpFile('file-service-key\n')
  try {
    withEnvKey('  env-service-key  ', () => {
      assert.equal(resolveKey({ keyFile: f }), 'env-service-key')
    })
  } finally { cleanup() }
})
