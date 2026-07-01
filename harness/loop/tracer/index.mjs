#!/usr/bin/env node
/**
 * tracer — CANDIDATE (pre-admission; see governance/rules/harness-admission.md), not admitted. See
 * governance/rules/harness-admission.md.
 *
 * The cross-cutting trace context for the signal loop. Every signal opens ONE trace
 * (`traceId`); every hop it passes through (extract → classify → estimate → route →
 * outcome) opens a child SPAN (`spanId`, linked to its parent). Combined with the
 * four-tuple (session · run · call · branch) from the data-layer decision, a single
 * action is followable end-to-end as one trace — the OpenTelemetry methodology the
 * architecture calls for (governance/decisions/data-layer.md).
 *
 * Pure + deterministic-friendly: every source of nondeterminism (id, clock) is
 * injectable, so tests pin them and the loop stays provable. Zero-dependency.
 */
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..', '..', '..')

const nowIso = () => new Date().toISOString()

// ── trace + spans ─────────────────────────────────────────────────────────────
/** Open a new trace for one signal. `id`/`now` injectable for deterministic tests. */
export function newTrace({ id, now = nowIso } = {}) {
  return { traceId: id || randomUUID(), spanId: null, parentSpanId: null, startedAt: now() }
}

/** Open a child span (one hop). Carries the trace id; links to the parent span. */
export function span(ctx, name, { id, now = nowIso } = {}) {
  if (!ctx || !ctx.traceId) throw new Error('span() needs a context with a traceId (call newTrace first)')
  return {
    traceId: ctx.traceId,
    spanId: id || randomUUID(),
    parentSpanId: ctx.spanId ?? null,
    name: String(name),
    startedAt: now(),
  }
}

// ── four-tuple (session · run · call · branch) ──────────────────────────────────
export function gitBranch(root = REPO_ROOT) {
  try { return execFileSync('git', ['-C', root, 'branch', '--show-current'], { encoding: 'utf8' }).trim() || null }
  catch { return null }
}
export function gitHead(root = REPO_ROOT) {
  try { return execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim() || null }
  catch { return null }
}
export function harnessVersion(root = REPO_ROOT) {
  try { return JSON.parse(readFileSync(join(root, 'harness/manifest.json'), 'utf8')).harnessVersion ?? null }
  catch { return null }
}

/**
 * The active harness release identifier — `harnessVersion` from the manifest, confirmed by the
 * presence of its pin file `.system/releases/<harnessVersion>.json`. Pure observability, so it
 * fails OPEN: any error (missing manifest, bad JSON, missing pin) degrades to `null`, never throws.
 */
export function activeRelease(root = REPO_ROOT) {
  try {
    const v = harnessVersion(root)
    if (!v) return null
    // Confirm the release is pinned; if the pin is missing we still return the version (fail-open).
    try { readFileSync(join(root, `.system/releases/${v}.json`), 'utf8') } catch { /* pin optional */ }
    return v
  } catch { return null }
}

/**
 * The registered version of a component id, read from the manifest's component
 * census (harness/manifest.json — the manifest census was merged in at the os-reshape
 * P1 merge). Fail-OPEN: any error, or an id with no matching component,
 * degrades to `null`. `null` for a target that isn't a component id
 * (e.g. 'unknown') — that's expected, not an error.
 */
export function componentVersion(id, root = REPO_ROOT) {
  try {
    if (!id) return null
    const man = JSON.parse(readFileSync(join(root, 'harness/manifest.json'), 'utf8'))
    const c = (man.components || []).find((x) => x.id === id)
    return c?.version ?? null
  } catch { return null }
}

/** Fill the four-tuple from explicit values, then env, then git. */
export function fourTuple({ session, run, call, branch } = {}) {
  const sess = session ?? process.env.CLAUDE_CODE_SESSION_ID ?? null
  return {
    session: sess,
    run: run ?? sess ?? null,
    call: call ?? null,
    branch: branch ?? gitBranch(),
  }
}

// ── stamping ────────────────────────────────────────────────────────────────────
/** Merge trace context (and optional four-tuple) onto a row about to be recorded. */
export function stamp(row, ctx = {}, tuple = null) {
  const t = tuple || {}
  return {
    ...row,
    traceId: ctx.traceId ?? null,
    spanId: ctx.spanId ?? null,
    parentSpanId: ctx.parentSpanId ?? null,
    ...(tuple ? { session: t.session ?? null, run: t.run ?? null, call: t.call ?? null, branch: t.branch ?? null } : {}),
  }
}

// ── thin CLI (smoke) ─────────────────────────────────────────────────────────────
function main() {
  const t = newTrace()
  const s1 = span(t, 'extract')
  const s2 = span(s1, 'classify')
  process.stdout.write(JSON.stringify({ trace: t.traceId, spans: [s1.name, s2.name], linked: s2.parentSpanId === s1.spanId }, null, 2) + '\n')
}
if (import.meta.url === `file://${process.argv[1]}`) main()
