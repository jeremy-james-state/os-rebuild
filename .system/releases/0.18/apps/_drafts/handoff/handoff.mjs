#!/usr/bin/env node
/**
 * handoff — CANDIDATE (apps/_drafts/). The deterministic spine of the session handoff, brought
 * into the governed harness. Mirrors the incident spine: the SAVE LOCATION is computed in code, not
 * passed as a free-form argument, so a handoff cannot be written anywhere but record/handoffs/.
 *
 * The hard rule (the guarantee): a handoff is ALWAYS saved to
 *   record/handoffs/handoff-<YYYY-MM-DD>.md   (the append-only, tracked-markdown history)
 * and the latest is ALWAYS rendered to
 *   docs/RESUME-HERE.md                        (the always-same-path "read this first")
 * Neither path can be redirected by the caller. `handoffsDir`/`resumePath` derive them from
 * REPO_ROOT; `save()` writes exactly there. The co-located test locks this — if the save path ever
 * changes, the test fails and the merge gate rejects it.
 *
 * A handoff is COMPLETE only when all seven sections are present (mirrors incident's isComplete):
 *   Current state · Mission · Working model · What's on main · In flight · Next steps · Gotchas.
 * `isComplete`/`missingSections` make that deterministic — a check, not a doc you can forget.
 *
 * Drives the /handoff slash command. Zero-dependency (Node built-ins). Commands:
 *   new                scaffold record/handoffs/handoff-<date>.md from the template (sections empty)
 *   check [file|all]   report missing sections; EXIT 1 if any handoff is incomplete (gate-ready)
 *   list               list handoffs with missing-section count
 */
import { realpathSync, readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..', '..', '..')

// The save location is GUARANTEED: computed from the repo root, never a free-form argument.
// A test root can be injected for hermetic tests, but a caller cannot redirect the real save.
export const handoffsDir = (root = REPO_ROOT) => join(root, 'record', 'handoffs')
export const resumePath = (root = REPO_ROOT) => join(root, 'docs', 'RESUME-HERE.md')

// The seven required sections, with the `## ` header label each maps to in a handoff file.
// Derived from record/handoffs/_template.md.
export const SECTIONS = [
  { key: 'currentState', label: 'Current state' },
  { key: 'mission', label: 'Mission' },
  { key: 'workingModel', label: 'Working model' },
  { key: 'onMain', label: "What's on main" },
  { key: 'inFlight', label: 'In flight' },
  { key: 'nextSteps', label: 'Next steps' },
  { key: 'gotchas', label: 'Gotchas' },
]

/** Content is "empty" if blank or still a `<placeholder>`. */
const isEmpty = (txt) => { const t = String(txt || '').trim(); return t.length === 0 || /^<[^>]*>$/.test(t) }

/**
 * Parse a handoff's markdown into { sections: {key: content} }. A section runs from its `## Label`
 * header to the next `## ` header. Matching is prefix/case-insensitive on the label so
 * "## Current state (one line)" and "## Gotchas / constraints" both resolve.
 */
export function parseHandoff(md) {
  const lines = String(md).split('\n')
  const sections = {}
  const matchKey = (heading) => {
    const h = heading.trim().toLowerCase()
    const m = SECTIONS.find((s) => h.startsWith(s.label.toLowerCase()))
    return m ? m.key : null
  }
  let active = null
  let buf = []
  const flush = () => { if (active) sections[active] = buf.join('\n').trim(); active = null; buf = [] }
  for (const line of lines) {
    const h = line.match(/^##\s+(.+?)\s*$/)
    if (h) {
      flush()
      const key = matchKey(h[1])
      if (key) { active = key; buf = [] }
      continue
    }
    if (active) buf.push(line)
  }
  flush()
  return { sections }
}

export function missingSections(parsed) {
  return SECTIONS.filter((s) => isEmpty(parsed.sections?.[s.key])).map((s) => s.key)
}
export const isComplete = (parsed) => missingSections(parsed).length === 0

const today = () => new Date().toISOString().slice(0, 10)

// The section body shared by the dated history file and the RESUME render. Derived from
// record/handoffs/_template.md so the two surfaces carry the same seven sections.
const SECTION_BODY = `## Current state (one line)

<one sentence: where things stand right now>

## Mission

<one paragraph: what this repo is for and what problem it solves>

## Working model

<how Claude + Copilot + human collaborate; the review/merge gate; who can merge>

## What's on main

<bullet list: governance decisions, enforcement scripts, settled content already merged>

## In flight

<bullet list of open PRs / branches and what each is doing; PR number + title where available>

## Next steps

<ordered list of the highest-priority actions for the next session>

## Gotchas / constraints

<bullet list of non-obvious constraints, current blockers, or things that bite if forgotten>
`

/** The dated history file = a small header (id / session / git_head) + the body. */
export function renderDated(body, { date, session, gitHead }) {
  const d = date || today()
  return `# Handoff — ${d}

- **id:** handoff-${d}
- **session:** ${session || 'unknown'}
- **git_head:** ${gitHead || 'unknown'}

> One file per handoff (append-only history). The always-current render of the **latest**
> handoff lives at [\`../../docs/RESUME-HERE.md\`](../../docs/RESUME-HERE.md) — read that first.

${body.trim()}
`
}

/** docs/RESUME-HERE.md = the always-current render of the latest handoff body (no per-file header). */
export function renderResume(body) {
  return `# RESUME HERE

> Auto-generated by \`/handoff\` — overwrite each session. Do not edit by hand.
> The dated history lives in [\`../record/handoffs/\`](../record/handoffs/).

${body.trim()}
`
}

/**
 * save — the guarantee. Writes the handoff body to BOTH surfaces at their GUARANTEED paths:
 *   record/handoffs/handoff-<date>.md  (dated history; filename derived from the date)
 *   docs/RESUME-HERE.md                (latest render; always the same path)
 * The paths are computed from `root` (defaults to REPO_ROOT) via handoffsDir/resumePath — the caller
 * supplies the CONTENT and metadata, never the location. Returns { datedPath, resumePath, id }.
 */
export function save(body, { root = REPO_ROOT, date, session, gitHead } = {}) {
  const d = date || today()
  const id = `handoff-${d}`
  const dir = handoffsDir(root)
  mkdirSync(dir, { recursive: true })
  const datedPath = join(dir, `${id}.md`)
  writeFileSync(datedPath, renderDated(body, { date: d, session, gitHead }))

  const resume = resumePath(root)
  mkdirSync(dirname(resume), { recursive: true })
  writeFileSync(resume, renderResume(body))

  return { datedPath, resumePath: resume, id }
}

/** Scaffold an empty (template) handoff into record/handoffs/ — the /handoff `new` entry point. */
export function scaffold({ root = REPO_ROOT, date, session, gitHead } = {}) {
  const d = date || today()
  const r = save(SECTION_BODY, { root, date: d, session, gitHead })
  return { ...r, created: true }
}

export function listHandoffs(dir = handoffsDir()) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md' && f !== '_template.md')
    .sort().map((f) => {
      const parsed = parseHandoff(readFileSync(join(dir, f), 'utf8'))
      return { file: f, missing: missingSections(parsed) }
    })
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'new') {
    const r = scaffold()
    process.stdout.write(`created ${r.datedPath}\n  + rendered ${r.resumePath}\n  fill the 7 sections, then re-run to save.\n`)
  } else if (cmd === 'check') {
    const target = rest[0]
    const items = (target && target !== 'all')
      ? [{ file: basename(target), missing: missingSections(parseHandoff(readFileSync(target, 'utf8'))) }]
      : listHandoffs()
    let bad = 0
    for (const it of items) {
      const note = it.missing.length ? `missing: ${it.missing.join(', ')}` : 'complete'
      const flag = it.missing.length ? ' ✗ INCOMPLETE' : ''
      if (flag) bad++
      process.stdout.write(`  ${it.file} — ${note}${flag}\n`)
    }
    if (bad) { process.stderr.write(`\n${bad} handoff(s) missing sections — not done.\n`); process.exitCode = 1 }
  } else if (cmd === 'list') {
    for (const it of listHandoffs()) process.stdout.write(`  ${it.file} (${it.missing.length} section(s) missing)\n`)
  } else {
    process.stdout.write('usage: handoff <new | check [file|all] | list>\n')
  }
}

/**
 * CLI main-guard, symlink-proof: node resolves import.meta.url to the REAL
 * path, while argv[1] may arrive through a symlink (.system/releases/current,
 * macOS /var, a spaced path). Comparing unresolved forms silently skips main()
 * — exit 0, no output — the exact silent-failure class caught twice in the
 * os-reshape (P0 rig, P2 sealed boot). Realpath both sides; any error → false.
 */
function cliInvoked(metaUrl) {
  try { return !!process.argv[1] && metaUrl === pathToFileURL(realpathSync(process.argv[1])).href } catch { return false }
}

if (cliInvoked(import.meta.url)) main()
