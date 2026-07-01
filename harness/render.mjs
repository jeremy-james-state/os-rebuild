#!/usr/bin/env node
// harness/render.mjs — render the machine-readable manifest.json into its
// human-readable twin manifest.md. JSON is the source of truth; MD is generated.
// Deterministic: no clocks, no randomness. The doctor checks the committed MD
// matches this output, so the two representations can never silently diverge.
//
// Run: node harness/render.mjs           # print to stdout
//      node harness/render.mjs --write    # write harness/manifest.md

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

function row(cells) { return `| ${cells.join(' | ')} |` }

export function render(manifest) {
  const L = []
  L.push('# OS Harness — Manifest (generated)')
  L.push('')
  L.push('> Generated from `harness/manifest.json` by `harness/render.mjs`.')
  L.push('> Do not edit by hand — edit the JSON and run `node harness/render.mjs --write`.')
  L.push('')
  L.push(`**Harness version:** ${manifest.harnessVersion || '?'} · **Manifest format:** ${manifest.manifestVersion || '?'} · **Updated:** ${manifest.updated || '?'}`)
  L.push('')

  // Boundary
  const b = manifest.boundary || {}
  L.push('## Boundary')
  L.push('')
  L.push(`- **Model:** ${b.model || ''}`)
  L.push(`- **Production:** ${b.productionDir || ''}`)
  L.push(`- **Sandbox:** ${b.sandboxDir || ''}`)
  if (b.note) L.push(`- **Note:** ${b.note}`)
  L.push('')

  // Sequence (the shape)
  const seq = manifest.sequence
  if (seq) {
    L.push('## Sequence — the shape (session → … → observe)')
    L.push('')
    if (seq.description) { L.push(seq.description); L.push('') }
    L.push(row(['#', 'Phase', 'Step', 'Maps to', 'Produces']))
    L.push(row(['---', '---', '---', '---', '---']))
    for (const s of seq.steps || []) {
      const maps = [s.component ? `component:${s.component}` : '', s.stage ? `stage:${s.stage}` : ''].filter(Boolean).join(' / ')
      L.push(row([String(s.order), s.phase, s.id, maps, s.produces || '']))
    }
    L.push('')
  }

  // Components by state
  L.push('## Components by state')
  L.push('')
  const byState = {}
  for (const c of manifest.components || []) (byState[c.state] ||= []).push(c)
  for (const state of manifest.states || Object.keys(byState)) {
    const items = (byState[state] || []).sort((a, b) => a.id.localeCompare(b.id))
    if (!items.length) continue
    L.push(`### ${state} (${items.length})`)
    L.push('')
    L.push(row(['Component', 'Type', 'Kind', 'Path', 'Role']))
    L.push(row(['---', '---', '---', '---', '---']))
    for (const c of items) {
      const role = c.flags && c.flags.length ? `${c.role}  ⚠ ${c.flags.join('; ')}` : c.role
      L.push(row([c.id, c.type || '', c.kind || '', `\`${c.path}\``, role]))
    }
    L.push('')
  }

  // Work chain
  if (manifest.chain && manifest.chain.stages) {
    L.push('## Work chain (idea → … → monitor)')
    L.push('')
    L.push(row(['Stage', 'Status', 'Contract / surface']))
    L.push(row(['---', '---', '---']))
    for (const s of manifest.chain.stages) {
      L.push(row([s.id, s.status, s.contract || s.surface || '']))
    }
    L.push('')
  }

  // Environment
  const env = manifest.environment || {}
  if (env.gaps) {
    L.push('## Environment — determinism gaps')
    L.push('')
    for (const g of env.gaps) L.push(`- ${g}`)
    L.push('')
  }

  // Governance
  const gov = manifest.governance || {}
  if (gov.laws) {
    L.push('## Governance')
    L.push('')
    if (gov.model) { L.push(gov.model); L.push('') }
    L.push(row(['#', 'Law', 'Enforced']))
    L.push(row(['---', '---', '---']))
    for (const law of gov.laws) L.push(row([String(law.id), law.name, String(law.enforced)]))
    L.push('')
    if (gov.buildRules) {
      L.push('**Build rules:**')
      L.push('')
      for (const r of gov.buildRules) L.push(`- ${r}`)
      L.push('')
    }
  }

  return L.join('\n') + '\n'
}

// renderIndex — the component index (harness/index.md). Grouped by type in a
// fixed order, sorted by id within each group. Deterministic: no clocks/randomness.
const INDEX_TYPE_ORDER = ['orchestrator', 'runner', 'service', 'hook', 'library']

export function renderIndex(components) {
  const L = []
  L.push('# OS Harness — Component Index (generated)')
  L.push('')
  L.push('> Generated from `harness/registry.json` by `harness/render.mjs`.')
  L.push('> Do not edit by hand — edit the JSON and run `node harness/render.mjs --index`.')
  L.push('')
  const comps = components || []
  const byType = {}
  for (const c of comps) (byType[c.type] ||= []).push(c)
  // Fixed type order first, then any leftover types alphabetically (defensive).
  const seen = new Set(INDEX_TYPE_ORDER)
  const extra = Object.keys(byType).filter((t) => !seen.has(t)).sort()
  const order = [...INDEX_TYPE_ORDER, ...extra]
  for (const type of order) {
    const items = (byType[type] || []).slice().sort((a, b) => a.id.localeCompare(b.id))
    if (!items.length) continue
    L.push(`### ${type} (${items.length})`)
    L.push('')
    L.push(row(['Component', 'Version', 'State', 'Kind', 'Path', 'Role']))
    L.push(row(['---', '---', '---', '---', '---', '---']))
    for (const c of items) {
      L.push(row([c.id, c.version || '—', c.state || '', c.kind || '', `\`${c.path}\``, c.role || '']))
    }
    L.push('')
  }
  return L.join('\n') + '\n'
}

// renderChangelog — one component's CHANGELOG.md, built from its versions array.
// Deterministic: preserves the array order given (newest-last is fine).
export function renderChangelog(component) {
  const L = []
  const id = (component && component.id) || '?'
  L.push(`# ${id} — changelog (generated)`)
  L.push('')
  L.push('> Generated from `harness/registry.json` by `harness/render.mjs`.')
  L.push('> Do not edit by hand — edit the JSON and run `node harness/render.mjs --changelogs`.')
  L.push('')
  L.push(row(['Version', 'Date', 'Change']))
  L.push(row(['---', '---', '---']))
  const versions = (component && component.versions) || []
  for (const v of versions) {
    L.push(row([v.version || '', v.date || '', v.change || '']))
  }
  return L.join('\n') + '\n'
}

function main() {
  const manifest = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'))
  const registry = JSON.parse(readFileSync(join(HERE, 'registry.json'), 'utf8'))
  const components = registry.components || []
  const ROOT = resolve(HERE, '..')
  const args = process.argv.slice(2)

  if (args.includes('--index')) {
    writeFileSync(join(HERE, 'index.md'), renderIndex(components))
    process.stdout.write('wrote harness/index.md\n')
    return
  }

  if (args.includes('--changelogs')) {
    let wrote = 0
    let skipped = 0
    for (const c of components) {
      const dir = resolve(ROOT, c.path)
      if (existsSync(dir) && statSync(dir).isDirectory()) {
        writeFileSync(join(dir, 'CHANGELOG.md'), renderChangelog(c))
        wrote++
      } else {
        skipped++
      }
    }
    process.stdout.write(`wrote ${wrote} changelogs, skipped ${skipped} (dir absent)\n`)
    return
  }

  const merged = { ...manifest, components }
  const md = render(merged)
  if (args.includes('--write')) {
    writeFileSync(join(HERE, 'manifest.md'), md)
    process.stdout.write('wrote harness/manifest.md\n')
  } else {
    process.stdout.write(md)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
