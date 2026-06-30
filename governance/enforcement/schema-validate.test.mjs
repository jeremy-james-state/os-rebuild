// schema-validate tests — node:test, zero deps. Covers the JSON Schema subset the
// harness definition uses (type, required, properties, additionalProperties, items, enum).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validate } from './schema-validate.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const J = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))

test('valid object passes', () => {
  const schema = { type: 'object', required: ['a'], additionalProperties: false, properties: { a: { type: 'string' } } }
  assert.deepEqual(validate(schema, { a: 'x' }), [])
})

test('missing required is reported', () => {
  const schema = { type: 'object', required: ['a'], properties: { a: { type: 'string' } } }
  assert.match(validate(schema, {})[0], /missing required property 'a'/)
})

test('additionalProperties:false rejects stray keys', () => {
  const schema = { type: 'object', additionalProperties: false, properties: { a: { type: 'string' } } }
  assert.match(validate(schema, { a: 'x', b: 1 })[0], /unexpected property 'b'/)
})

test('type mismatch and enum violation are reported', () => {
  assert.match(validate({ type: 'string' }, 5)[0], /expected string/)
  assert.match(validate({ enum: ['x', 'y'] }, 'z')[0], /is not one of/)
})

test('array items are validated, including enum items', () => {
  const schema = { type: 'array', items: { enum: ['production', 'planned'] } }
  assert.deepEqual(validate(schema, ['production', 'planned']), [])
  assert.equal(validate(schema, ['nope']).length, 1)
})

// The real definition files must validate against their schemas — the gate depends on it.
test('the live harness definition validates against its schemas', () => {
  assert.deepEqual(validate(J('harness/manifest.schema.json'), J('harness/manifest.json')), [])
  assert.deepEqual(validate(J('harness/registry.schema.json'), J('harness/registry.json')), [])
  const cschema = J('harness/contract.schema.json')
  for (const c of ['harness/sandbox/signal-ledger/contract.json', 'harness/sandbox/investigator/contract.json']) {
    assert.deepEqual(validate(cschema, J(c)), [], `${c} should conform`)
  }
})
