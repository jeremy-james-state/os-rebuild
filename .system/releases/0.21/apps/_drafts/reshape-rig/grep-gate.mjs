#!/usr/bin/env node
/**
 * reshape-rig/grep-gate.mjs — the scoped stale-path gate for the reshape.
 *
 * After P1 moves files, NO runtime code or live config may still reference a
 * pre-move path. This gate greps for the forbidden patterns and exits 1 on any
 * hit. SCOPE (per the plan §A): runtime code + live config only — it EXCLUDES
 * the append-only ledger, changelog history, record/, and decision/spec docs,
 * which legitimately record old paths.
 *
 *   node grep-gate.mjs                exit 1 on hits, or if no patterns are
 *                                     configured (a vacuous pass is a silent
 *                                     failure — P1 must fill PATTERNS)
 *   node grep-gate.mjs --allow-empty  pre-P1: tolerate the empty pattern list
 *   node grep-gate.mjs --json         machine-readable report
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')

/**
 * Forbidden stale-path patterns. EMPTY until P1 executes the move — then P1
 * fills this with the old→new map's left-hand sides, e.g.:
 *   { pattern: /harness\/sandbox\//, note: 'moved → harness/loop|guard/ + apps/_drafts/' },
 *   { pattern: /governance\/enforcement\//, note: 'moved → governance/checks/' },
 *   { pattern: /(?<![.\w])scripts\//, note: 'moved → .system/sync/' },
 */
export const PATTERNS = [
  { pattern: /harness\/sandbox\//, note: 'moved: harness loop|guard + apps _drafts' },
  { pattern: /governance\/enforcement\//, note: 'moved: governance checks' },
  { pattern: /(?<![.\w/-])scripts\//, note: 'moved: .system sync' },
  { pattern: /harness\/releases\//, note: 'pins moved: .system releases (render.mjs stays in harness)' },
  { pattern: /harness\/(orchestrators|runners|services|hooks)\//, note: 'type-folders collapsed - type is a field, not a folder' },
  { pattern: /harness\/registry(\.schema)?\.json/, note: 'merged into harness manifest.json (one spine file)' },
]

/** Scope: runtime code + live config. */
const INCLUDE_DIRS = ['harness', 'governance', 'scripts', 'apps', 'skills', '.system', '.claude', '.github']
const INCLUDE_EXT = new Set(['.mjs', '.js', '.json', '.yml', '.yaml'])
/** Excluded (legitimately record old paths, or are not runtime): */
const EXCLUDE = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)record(\/|$)/,
  /(^|\/)docs(\/|$)/,
  /(^|\/)state(\/|$)/,
  /CHANGELOG\.md$/,
  /governance-ledger\.jsonl$/,
  /(^|\/)golden-master\.json$/,   // pinned pre-reshape behaviour — old paths expected
  /(^|\/)move-map\.json$/,        // the survey artifact — deliberately RECORDS pre-move paths
  /(^|\/)\.system\/releases\/[^/]+\//, // sealed snapshots are immutable history — they record the paths of their era (also skips the `current` symlink double-scan)
  /(^|\/)coverage\.json$/,        // §D2 id → owner map; names pre-move test paths
  /(^|\/)decisions(\/|$)/,        // governance/decisions history
  /(^|\/)web(\/|$)/,              // NN2: pinned, untouched
]

function* walk(dir) {
  let entries = []
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    const p = join(dir, name)
    const rel = relative(REPO, p)
    if (EXCLUDE.some((re) => re.test(rel))) continue
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) yield* walk(p)
    else if (INCLUDE_EXT.has(name.slice(name.lastIndexOf('.')))) yield rel
  }
}

export function runGrepGate({ patterns = PATTERNS } = {}) {
  const hits = []
  for (const top of INCLUDE_DIRS) {
    const dir = join(REPO, top)
    for (const rel of walk(dir)) {
      let text
      try { text = readFileSync(join(REPO, rel), 'utf8') } catch { continue }
      const lines = text.split('\n')
      for (let i = 0; i < lines.length; i += 1) {
        for (const { pattern, note } of patterns) {
          if (pattern.test(lines[i])) hits.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 160), note })
        }
      }
    }
  }
  return { patterns: patterns.length, hits }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = runGrepGate()
  const json = process.argv.includes('--json')
  if (!res.patterns && !process.argv.includes('--allow-empty')) {
    process.stderr.write('grep-gate: ZERO patterns configured — a vacuous pass is a silent failure. Fill PATTERNS (P1) or pass --allow-empty (pre-P1 only).\n')
    process.exit(1)
  }
  if (json) process.stdout.write(JSON.stringify(res, null, 2) + '\n')
  else {
    for (const h of res.hits) process.stdout.write(`✗ ${h.file}:${h.line}  ${h.text}   [${h.note}]\n`)
    process.stdout.write(res.hits.length ? `grep-gate: ${res.hits.length} stale reference(s)\n` : `grep-gate: 0 hits across ${res.patterns} pattern(s) ✓\n`)
  }
  process.exit(res.hits.length ? 1 : 0)
}
