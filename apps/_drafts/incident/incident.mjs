#!/usr/bin/env node
/**
 * incident — CANDIDATE (apps/_drafts/). The deterministic spine of the incident log, brought
 * forward from the archived frame-gate-local/improve/incident.mjs and adapted from SQLite to the
 * markdown data layer (record/incidents/*.md).
 *
 * The hard rule (unchanged): an incident is DONE only when all five steps are present.
 *   1. rootCause        2. recreatedSteps   3. immediateFix   4. longTermSolution   5. preventative
 * `isComplete`/`missingSteps` make that deterministic — not a doc you can forget, a check.
 *
 * Drives the /incident slash command. Zero-dependency (Node built-ins). Commands:
 *   new "<title>"   scaffold record/incidents/incident-<date>-<slug>.md (status: open, steps empty)
 *   check [file|all]  report missing steps; EXIT 1 if any *resolved* incident is incomplete (gate-ready)
 *   list            list incidents with status + missing-step count
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..', '..', '..')
export const incidentsDir = () => join(REPO_ROOT, 'record', 'incidents')

// The five steps, with the markdown header label each maps to in an incident file.
export const STEPS = [
  { key: 'rootCause', label: 'Root cause' },
  { key: 'recreatedSteps', label: 'Recreated' },
  { key: 'immediateFix', label: 'Immediate fix' },
  { key: 'longTermSolution', label: 'Long-term solution' },
  { key: 'preventative', label: 'Preventative' },
]

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled'
/** Content is "empty" if blank or still a `<placeholder>`. */
const isEmpty = (txt) => { const t = String(txt || '').trim(); return t.length === 0 || /^<[^>]*>$/.test(t) }

/** Parse an incident's markdown into { status, steps: {key: content} }. */
export function parseIncident(md) {
  const status = (md.match(/^- \*\*status:\*\*\s*(.+)$/m)?.[1] || '').trim().toLowerCase()
  const lines = md.split('\n')
  const steps = {}
  const labelToKey = new Map(STEPS.map((s) => [s.label.toLowerCase(), s.key]))
  let active = null
  let buf = []
  const flush = () => { if (active) steps[active] = buf.join('\n').trim(); active = null; buf = [] }
  for (const line of lines) {
    const m = line.match(/^\s*\d+\.\s*\*\*(.+?)\*\*\s*[—-]?\s*(.*)$/)
    if (m) {
      flush()
      const key = labelToKey.get(m[1].trim().toLowerCase())
      if (key) { active = key; buf = m[2] ? [m[2]] : [] }
      continue
    }
    if (active) {
      if (/^##\s/.test(line)) { flush() } else buf.push(line)
    }
  }
  flush()
  return { status, steps }
}

export function missingSteps(parsed) {
  return STEPS.filter((s) => isEmpty(parsed.steps?.[s.key])).map((s) => s.key)
}
export const isComplete = (parsed) => missingSteps(parsed).length === 0

const TEMPLATE = (title, date, id) => `# Incident — ${title} (${date})

- **id:** ${id}
- **severity:** low | moderate | severe
- **status:** open
- **owner:** <who holds it>
- **related:** <ledger ids, PRs, decisions>

## Summary

<One paragraph: what happened, in plain terms.>

## The five steps

> An incident is done only when all five are present.

1. **Root cause** — <the confirmed cause, with evidence — not a guess>
2. **Recreated** — <how to reproduce it>
3. **Immediate fix** — <what stopped the bleeding now>
4. **Long-term solution** — <the durable fix>
5. **Preventative** — <the hook / guard / check / rule so it cannot recur>

## Lesson

<What this teaches about the harness / governance.>
`

export function scaffold(title, { dir = incidentsDir(), date } = {}) {
  const d = date || new Date().toISOString().slice(0, 10)
  const slug = slugify(title)
  const id = `incident-${d}-${slug}`
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${id}.md`)
  if (existsSync(file)) return { file, created: false, id }
  writeFileSync(file, TEMPLATE(title, d, id))
  return { file, created: true, id }
}

export function listIncidents(dir = incidentsDir()) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md' && f !== '_template.md')
    .sort().map((f) => {
      const parsed = parseIncident(readFileSync(join(dir, f), 'utf8'))
      return { file: f, status: parsed.status || 'open', missing: missingSteps(parsed) }
    })
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'new') {
    const title = rest.join(' ').trim()
    if (!title) { process.stderr.write('usage: incident new "<title>"\n'); process.exitCode = 1; return }
    const r = scaffold(title)
    process.stdout.write(r.created ? `created ${r.file}\n  fill the 5 steps, then set status: resolved\n` : `exists: ${r.file}\n`)
  } else if (cmd === 'check') {
    const target = rest[0]
    const items = (target && target !== 'all')
      ? [{ file: basename(target), status: parseIncident(readFileSync(target, 'utf8')).status || 'open', missing: missingSteps(parseIncident(readFileSync(target, 'utf8'))) }]
      : listIncidents()
    let bad = 0
    for (const it of items) {
      const note = it.missing.length ? `missing: ${it.missing.join(', ')}` : 'complete'
      const flag = (it.status === 'resolved' && it.missing.length) ? ' ✗ RESOLVED BUT INCOMPLETE' : ''
      if (flag) bad++
      process.stdout.write(`  [${it.status}] ${it.file} — ${note}${flag}\n`)
    }
    if (bad) { process.stderr.write(`\n${bad} resolved incident(s) missing steps — not done.\n`); process.exitCode = 1 }
  } else if (cmd === 'list') {
    for (const it of listIncidents()) process.stdout.write(`  [${it.status}] ${it.file} (${it.missing.length} step(s) missing)\n`)
  } else {
    process.stdout.write('usage: incident <new "title" | check [file|all] | list>\n')
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main()
