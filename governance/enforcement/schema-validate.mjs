#!/usr/bin/env node
// governance/enforcement/schema-validate.mjs — a minimal, zero-dependency JSON Schema
// validator (the subset of draft 2020-12 the harness definition actually uses).
//
// Supports: type, required, properties, additionalProperties, items, enum. Annotation
// keywords ($schema, $id, title, description) are ignored. Returns a flat array of
// human-readable error strings; an empty array means valid.
//
// Why hand-rolled: the harness is zero-dependency (no ajv). The schemas it validates
// (harness/manifest.schema.json, registry.schema.json, contract.schema.json) only use
// the constructs above, so a ~40-line recursive checker is enough — and is itself
// governed code the doctor runs.

const TYPE_CHECKS = {
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: Array.isArray,
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number',
  integer: (v) => typeof v === 'number' && Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  null: (v) => v === null,
}

function typeName(v) {
  return Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v
}

/** Validate `data` against `schema`. Returns [] when valid, else error strings. */
export function validate(schema, data, path = '$') {
  const errors = []
  walk(schema, data, path, errors)
  return errors
}

function walk(schema, data, path, errors) {
  if (!schema || typeof schema !== 'object') return

  if (schema.type) {
    const check = TYPE_CHECKS[schema.type]
    if (check && !check(data)) {
      errors.push(`${path}: expected ${schema.type}, got ${typeName(data)}`)
      return // type is wrong — deeper checks would be noise
    }
  }

  if (schema.enum && !schema.enum.some((e) => e === data)) {
    errors.push(`${path}: ${JSON.stringify(data)} is not one of ${JSON.stringify(schema.enum)}`)
  }

  if (TYPE_CHECKS.object(data)) {
    const props = schema.properties || {}
    for (const key of schema.required || []) {
      if (!(key in data)) errors.push(`${path}: missing required property '${key}'`)
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in props)) errors.push(`${path}: unexpected property '${key}'`)
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in data) walk(sub, data[key], `${path}.${key}`, errors)
    }
  }

  if (Array.isArray(data) && schema.items) {
    data.forEach((item, i) => walk(schema.items, item, `${path}[${i}]`, errors))
  }
}
