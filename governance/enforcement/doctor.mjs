#!/usr/bin/env node
// governance/enforcement/doctor.mjs — the harness drift-check (self-policing).
//
// Compares the declared harness (harness/manifest.json rails + harness/registry.json
// component rows, merged) against reality:
//   - every declared component exists on disk            (declared-but-absent = ERROR)
//   - no undeclared code surface is wired in             (present-but-undeclared = WARN)
//   - dependency ids resolve                             (missing dep = ERROR)
//   - production depends only on production              (sandbox/quarantined/retired dep = ERROR; staging dep = WARN)
//   - the environment the harness needs is pinned        (untracked settings / no .mcp.json = WARN)
//   - the current execution context is declared          (unknown context = WARN)
//   - the work chain is complete                         (missing/partial stage = WARN)
//
// Exit 0 = clean (warnings allowed). Exit 1 = drift (one or more ERRORs). Fail-closed.
//
// Zero-dependency. Run: node governance/enforcement/doctor.mjs [--inventory] [--json]

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, basename } from 'node:path'
import { render, renderIndex, renderChangelog } from '../../harness/render.mjs'
import { validate } from './schema-validate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..', '..')
const DEFAULT_MANIFEST = join(DEFAULT_ROOT, 'harness', 'manifest.json')
const DEFAULT_REGISTRY = join(DEFAULT_ROOT, 'harness', 'registry.json')

// Top-level dirs that legitimately hold non-harness code and are not expected
// to be manifest components. Curated; keep this list honest as the repo evolves.
const KNOWN_NON_HARNESS = new Set([
  'scripts', 'handoffs', 'foundation', 'templates', 'requirements',
  'definitions', 'reviews', 'learnings', 'reflections', 'incidents',
  'decisions', 'specs', 'archive', '_states', 'tmp', 'node_modules',
  '.git', '.github', '.githooks', '.obsidian', '.claude', '.harness-state',
  '.harness-approvals', 'archive', 'docs', 'governance', 'record', 'state',
  // Generated session outputs — sprawl slated for sandbox/ relocation or removal.
  'session-1-output', 'session-2-output', 'session-3-output', 'session-4-output',
])

function ok(v) { return v !== undefined && v !== null }

export function loadManifest(manifestPath = DEFAULT_MANIFEST) {
  const raw = readFileSync(manifestPath, 'utf8')
  return JSON.parse(raw)
}

export function loadRegistry(registryPath = DEFAULT_REGISTRY) {
  const raw = readFileSync(registryPath, 'utf8')
  return JSON.parse(raw)
}

function finding(severity, code, message, fix) {
  return { severity, code, message, fix: fix || '' }
}

function dirHasCode(dir) {
  try {
    for (const e of readdirSync(dir)) {
      if (e.endsWith('.mjs')) return true
    }
  } catch { /* not a dir */ }
  return false
}

function topSegment(p) {
  return p.replace(/^\.\//, '').split('/')[0]
}

// --- individual checks -------------------------------------------------------

export function checkComponents(manifest, root) {
  const out = []
  const validStates = new Set(manifest.states || [])
  for (const c of manifest.components || []) {
    if (!validStates.has(c.state)) {
      out.push(finding('ERROR', 'bad-state',
        `Component '${c.id}' has unknown state '${c.state}'.`,
        `Use one of: ${[...validStates].join(', ')}.`))
    }
    if (c.state === 'planned' || c.state === 'retired') continue
    const abs = join(root, c.path)
    if (!existsSync(abs)) {
      out.push(finding('ERROR', 'declared-but-absent',
        `Component '${c.id}' declares path '${c.path}' which does not exist.`,
        `Restore the file, fix the path, or set state to 'retired' and remove the entry.`))
    }
  }
  return out
}

// Self-admission guard: a component living under harness/sandbox/ must be state=sandbox.
// A candidate cannot be declared production/staging/planned while it still sits in the sandbox
// folder — admission (governance/rules/harness-admission.md) MOVES the code out of sandbox/ into
// its type-folder. A sandbox-path row claiming a non-sandbox state is drift (self-admission).
export function checkSandboxContainment(manifest) {
  const out = []
  for (const c of manifest.components || []) {
    const p = (c.path || '').replace(/^\.\//, '')
    if (p.startsWith('harness/sandbox/') && c.state !== 'sandbox') {
      out.push(finding('ERROR', 'sandbox-path-non-sandbox-state',
        `Component '${c.id}' lives under harness/sandbox/ but declares state='${c.state}'.`,
        `A sandbox-path component must be state=sandbox. Admission moves it out of sandbox/ into its type-folder (governance/rules/harness-admission.md) — never self-admit by flipping state in place.`))
    }
  }
  return out
}

export function checkUndeclared(manifest, root) {
  const out = []
  const covered = new Set()
  for (const c of manifest.components || []) covered.add(topSegment(c.path))
  let entries = []
  try { entries = readdirSync(root) } catch { return out }
  for (const name of entries) {
    if (KNOWN_NON_HARNESS.has(name)) continue
    if (covered.has(name)) continue
    let isDir = false
    try { isDir = statSync(join(root, name)).isDirectory() } catch { continue }
    if (!isDir) continue
    if (dirHasCode(join(root, name))) {
      out.push(finding('WARN', 'present-but-undeclared',
        `Directory '${name}/' contains code but is not in the manifest.`,
        `Add it as a component (state=sandbox if experimental), add it to KNOWN_NON_HARNESS, or remove it.`))
    }
  }
  return out
}

export function checkDependencies(manifest) {
  const out = []
  const byId = new Map((manifest.components || []).map(c => [c.id, c]))
  const forbiddenForProduction = new Set(['sandbox', 'quarantined', 'retired', 'planned'])
  for (const c of manifest.components || []) {
    for (const depId of c.dependsOn || []) {
      const dep = byId.get(depId)
      if (!dep) {
        out.push(finding('ERROR', 'missing-dependency',
          `Component '${c.id}' depends on '${depId}', which is not declared.`,
          `Declare '${depId}' or fix the dependsOn list.`))
        continue
      }
      if (c.state === 'production') {
        if (forbiddenForProduction.has(dep.state)) {
          out.push(finding('ERROR', 'production-depends-on-unstable',
            `Production component '${c.id}' depends on '${depId}' which is state=${dep.state}.`,
            `Promote '${depId}' to production, or remove the dependency. Production must not depend on ${[...forbiddenForProduction].join('/')}.`))
        } else if (dep.state === 'staging') {
          out.push(finding('WARN', 'production-depends-on-staging',
            `Production component '${c.id}' depends on '${depId}' which is still state=staging.`,
            `Finish promoting '${depId}' to production, or treat this dependency as not-yet-active.`))
        }
      }
    }
  }
  return out
}

export function checkEnvironment(manifest, root) {
  const out = []
  const env = manifest.environment || {}
  // settings pinned in repo?
  let tracked = []
  try {
    tracked = execFileSync('git', ['-C', root, 'ls-files', '.claude', 'local-tracker/.claude'], { encoding: 'utf8' })
      .split('\n').filter(Boolean)
  } catch { /* git may be unavailable */ }
  const hasRootSettings = tracked.some(f => f === '.claude/settings.json' || f === '.claude/settings.local.json')
  if (!hasRootSettings) {
    out.push(finding('WARN', 'settings-not-pinned',
      `No tracked .claude/settings.json — the hook wiring the laws depend on lives outside the repo.`,
      `Track a settings.json that wires SessionStart + PreToolUse (Phase 2), so the environment is reproducible.`))
  }
  // MCP servers declared?
  const mcp = env.mcpServers || []
  if (mcp.length && !existsSync(join(root, '.mcp.json'))) {
    out.push(finding('WARN', 'mcp-undeclared',
      `Manifest references ${mcp.length} MCP server(s) but there is no .mcp.json in the repo.`,
      `Add a .mcp.json declaring the servers the harness expects (Phase 2).`))
  }
  return out
}

export function checkContext(manifest, root) {
  const out = []
  const contexts = manifest.executionContexts || []
  let remote = ''
  try {
    remote = execFileSync('git', ['-C', root, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim().toLowerCase()
  } catch { /* ignore */ }
  const matched = contexts.some(ctx => {
    if (ctx.root && resolve(ctx.root) === resolve(root)) return true
    if (ctx.root && basename(ctx.root) === basename(root)) return true
    if (ctx.identity && remote) {
      const id = ctx.identity.replace(/^git-remote:/, '').toLowerCase()
      return remote.includes(id)
    }
    return false
  })
  if (!matched) {
    out.push(finding('WARN', 'unknown-context',
      `Current root '${root}' does not match any declared executionContext.`,
      `Add this environment to manifest.executionContexts, or run from a declared context.`))
  }
  return out
}

export function checkChain(manifest) {
  const out = []
  for (const s of (manifest.chain && manifest.chain.stages) || []) {
    if (s.status === 'missing') {
      out.push(finding('WARN', 'chain-stage-missing',
        `Work-chain stage '${s.id}' is missing.`,
        s.contract || `Define a contract and surface for '${s.id}'.`))
    } else if (s.status === 'partial') {
      out.push(finding('WARN', 'chain-stage-partial',
        `Work-chain stage '${s.id}' is only partial.`,
        s.contract || `Complete the contract for '${s.id}'.`))
    }
  }
  return out
}

export function checkSequence(manifest, root) {
  const out = []
  const seq = manifest.sequence
  if (!seq || !seq.steps) return out
  const compById = new Map((manifest.components || []).map(c => [c.id, c]))
  const stageIds = new Set(((manifest.chain && manifest.chain.stages) || []).map(s => s.id))
  const unstable = new Set(['sandbox', 'quarantined', 'retired', 'planned'])
  let prev = 0
  for (const s of seq.steps) {
    if (s.order !== prev + 1) {
      out.push(finding('ERROR', 'sequence-order-gap',
        `Sequence step '${s.id}' has order ${s.order}; expected ${prev + 1}.`,
        `Renumber sequence.steps to be contiguous from 1.`))
    }
    prev = s.order
    if (s.component && !compById.has(s.component)) {
      out.push(finding('ERROR', 'sequence-bad-component',
        `Sequence step '${s.id}' maps to component '${s.component}', which is not declared.`,
        `Declare the component or fix the sequence step.`))
    }
    if (s.stage && !stageIds.has(s.stage)) {
      out.push(finding('ERROR', 'sequence-bad-stage',
        `Sequence step '${s.id}' maps to chain stage '${s.stage}', which is not declared.`,
        `Add the stage to chain.stages or fix the sequence step.`))
    }
    if (!s.component && !s.stage) {
      out.push(finding('WARN', 'sequence-unmapped',
        `Sequence step '${s.id}' maps to no component or stage.`,
        `Map the step to a component and/or stage so the shape stays testable.`))
    }
    const comp = s.component && compById.get(s.component)
    if (comp && unstable.has(comp.state)) {
      out.push(finding('WARN', 'sequence-step-unstable',
        `Sequence step '${s.id}' relies on component '${s.component}' which is state=${comp.state}.`,
        `Promote '${s.component}' to production before treating this step as load-bearing.`))
    }
  }
  return out
}

export function checkMdSync(manifest, root) {
  const out = []
  const mdPath = join(root, 'harness', 'manifest.md')
  const expected = render(manifest)
  if (!existsSync(mdPath)) {
    out.push(finding('ERROR', 'md-twin-missing',
      `harness/manifest.md (the human-readable twin) is missing.`,
      `Run: node harness/render.mjs --write`))
    return out
  }
  const actual = readFileSync(mdPath, 'utf8')
  if (actual !== expected) {
    out.push(finding('ERROR', 'md-twin-stale',
      `harness/manifest.md is out of sync with manifest.json.`,
      `Run: node harness/render.mjs --write (and commit the result).`))
  }
  return out
}

// Recursively find every contract.json under a dir (skips dotdirs + node_modules).
function findContracts(dir, acc = []) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) findContracts(full, acc)
    else if (e.name === 'contract.json') acc.push(full)
  }
  return acc
}

// The harness DEFINITION conforms to its own schemas (the meta-level: the definition of
// the definition). manifest.json/registry.json validate against their schemas; every
// co-located contract.json validates against contract.schema.json. A missing schema file
// is skipped (not yet authored); a violation is drift (ERROR) — the schema is enforcement,
// not documentation. See governance/decisions/manifest-registry.md + enforcement-points.md.
export function checkSchemas(root = DEFAULT_ROOT) {
  const out = []
  const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'))
  const pairs = [
    ['harness/manifest.json', 'harness/manifest.schema.json', 'manifest'],
    ['harness/registry.json', 'harness/registry.schema.json', 'registry'],
  ]
  for (const [dataRel, schemaRel, label] of pairs) {
    if (!existsSync(join(root, schemaRel))) continue
    let schema, data
    try { schema = readJson(schemaRel) } catch (e) { out.push(finding('ERROR', 'schema-unreadable', `${schemaRel}: ${e.message}`, 'Fix the schema JSON.')); continue }
    try { data = readJson(dataRel) } catch { continue } // unreadable data is caught by runDoctor's loaders
    for (const err of validate(schema, data)) {
      out.push(finding('ERROR', `${label}-schema-violation`, `${dataRel} ${err}`, `Make ${dataRel} conform to ${schemaRel}.`))
    }
  }
  const contractSchemaRel = 'harness/contract.schema.json'
  if (existsSync(join(root, contractSchemaRel))) {
    let cschema
    try { cschema = readJson(contractSchemaRel) } catch (e) { return [...out, finding('ERROR', 'schema-unreadable', `${contractSchemaRel}: ${e.message}`, 'Fix the schema JSON.')] }
    for (const cpath of findContracts(join(root, 'harness'))) {
      const rel = cpath.slice(root.length + 1)
      let data
      try { data = JSON.parse(readFileSync(cpath, 'utf8')) } catch (e) { out.push(finding('ERROR', 'contract-unreadable', `${rel}: ${e.message}`, 'Fix the contract JSON.')); continue }
      for (const err of validate(cschema, data)) {
        out.push(finding('ERROR', 'contract-schema-violation', `${rel} ${err}`, `Make ${rel} conform to ${contractSchemaRel}.`))
      }
    }
  }
  return out
}

// A component that declares a version must carry a matching versions[] history entry — the
// structured source the CHANGELOG.md is generated from. Control (fail-closed): a version with no
// history line is an unrecorded change.
export function checkVersionChangelog(manifest) {
  const out = []
  for (const c of manifest.components || []) {
    if (!c.version) continue
    const vs = c.versions || []
    if (!vs.length) {
      out.push(finding('ERROR', 'version-without-history',
        `Component '${c.id}' declares version '${c.version}' but has no versions[] history.`,
        `Add a versions[] entry {version,date,change} for '${c.version}'.`))
      continue
    }
    const last = vs[vs.length - 1]
    if (last.version !== c.version) {
      out.push(finding('ERROR', 'version-changelog-mismatch',
        `Component '${c.id}' version '${c.version}' != latest versions[] entry '${last.version}'.`,
        `Bump versions[] (and regenerate CHANGELOG.md) whenever version changes.`))
    }
  }
  return out
}

// harness/index.md is GENERATED from registry.json — it must byte-match renderIndex(). Fail-closed,
// exactly like the manifest.md twin.
export function checkIndexSync(manifest, root) {
  const out = []
  const p = join(root, 'harness', 'index.md')
  const expected = renderIndex(manifest.components || [])
  if (!existsSync(p)) {
    out.push(finding('ERROR', 'index-missing', `harness/index.md is missing.`, `Run: node harness/render.mjs --index`))
    return out
  }
  if (readFileSync(p, 'utf8') !== expected) {
    out.push(finding('ERROR', 'index-stale', `harness/index.md is out of sync with registry.json.`, `Run: node harness/render.mjs --index (and commit).`))
  }
  return out
}

// Each committed per-component CHANGELOG.md must byte-match renderChangelog(row). Fail-closed.
// Only components that HAVE a CHANGELOG.md are checked (P1-b generates one per existing dir).
export function checkChangelogSync(manifest, root) {
  const out = []
  for (const c of manifest.components || []) {
    const p = join(root, c.path, 'CHANGELOG.md')
    if (!existsSync(p)) continue
    if (readFileSync(p, 'utf8') !== renderChangelog(c)) {
      out.push(finding('ERROR', 'changelog-stale',
        `${c.path}CHANGELOG.md is out of sync with its registry versions[].`,
        `Run: node harness/render.mjs --changelogs (and commit).`))
    }
  }
  return out
}

// The harness release version must have a release record pinning the current component set.
// Fail-closed. Tag/push reconciliation is the reconciler's fail-open job (P1-e), not a hard gate.
export function checkReleaseConsistency(manifest, root) {
  const out = []
  const hv = manifest.harnessVersion
  if (!hv) return out
  const p = join(root, 'harness', 'releases', `${hv}.json`)
  if (!existsSync(p)) {
    out.push(finding('ERROR', 'release-missing',
      `No release record harness/releases/${hv}.json for harnessVersion '${hv}'.`,
      `Cut the release (pin the component set), or fix harnessVersion.`))
    return out
  }
  let rel
  try { rel = JSON.parse(readFileSync(p, 'utf8')) } catch (e) {
    out.push(finding('ERROR', 'release-unreadable', `harness/releases/${hv}.json: ${e.message}`, 'Fix the release JSON.'))
    return out
  }
  const pins = rel.pins || {}
  for (const c of manifest.components || []) {
    if (!c.version) continue
    if (pins[c.id] !== c.version) {
      out.push(finding('ERROR', 'release-pin-drift',
        `Release ${hv} pins '${c.id}'=${pins[c.id] ?? '(absent)'} but registry has ${c.version}.`,
        `Re-cut the release to pin current versions, or bump harnessVersion for a new release.`))
    }
  }
  return out
}

// --- runner ------------------------------------------------------------------

export function runDoctor({ root = DEFAULT_ROOT, manifestPath = DEFAULT_MANIFEST, registryPath = DEFAULT_REGISTRY } = {}) {
  let manifest, registry
  try {
    manifest = loadManifest(manifestPath)
  } catch (e) {
    return { findings: [finding('ERROR', 'manifest-unreadable', `Cannot read manifest at ${manifestPath}: ${e.message}`, 'Fix the JSON.')], manifest: null }
  }
  try {
    registry = loadRegistry(registryPath)
  } catch (e) {
    return { findings: [finding('ERROR', 'registry-unreadable', `Cannot read component registry at ${registryPath}: ${e.message}`, 'Fix the JSON (harness/registry.json holds the component rows).')], manifest: null }
  }
  // Rails (manifest) + component rows (registry) are merged into one object so every
  // check reads `.components` and the rails off a single shape — no check changes.
  const merged = { ...manifest, components: registry.components || [] }
  const findings = [
    ...checkSchemas(root),
    ...checkComponents(merged, root),
    ...checkSandboxContainment(merged),
    ...checkUndeclared(merged, root),
    ...checkDependencies(merged),
    ...checkSequence(merged, root),
    ...checkEnvironment(merged, root),
    ...checkContext(merged, root),
    ...checkChain(merged),
    ...checkMdSync(merged, root),
    ...checkVersionChangelog(merged),
    ...checkIndexSync(merged, root),
    ...checkChangelogSync(merged, root),
    ...checkReleaseConsistency(merged, root),
  ]
  return { findings, manifest: merged }
}

function renderInventory(manifest) {
  const byState = {}
  for (const c of manifest.components || []) (byState[c.state] ||= []).push(c)
  const order = manifest.states || Object.keys(byState)
  const lines = ['HARNESS INVENTORY (generated from manifest.json)', '']
  for (const state of order) {
    const items = byState[state] || []
    if (!items.length) continue
    lines.push(`## ${state} (${items.length})`)
    for (const c of items.sort((a, b) => a.id.localeCompare(b.id))) {
      lines.push(`  ${c.id.padEnd(24)} ${(c.kind || '').padEnd(14)} ${c.path}`)
      lines.push(`  ${' '.repeat(24)} ${c.role}`)
      if (c.flags && c.flags.length) lines.push(`  ${' '.repeat(24)} ⚠ ${c.flags.join('; ')}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function main() {
  const args = process.argv.slice(2)
  const { findings, manifest } = runDoctor()

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({ findings }, null, 2) + '\n')
  } else if (args.includes('--inventory')) {
    if (manifest) process.stdout.write(renderInventory(manifest) + '\n')
  }

  if (!args.includes('--json')) {
    const errs = findings.filter(f => f.severity === 'ERROR')
    const warns = findings.filter(f => f.severity === 'WARN')
    const print = (f) => {
      process.stdout.write(`  [${f.severity}] ${f.code}: ${f.message}\n`)
      if (f.fix) process.stdout.write(`           fix: ${f.fix}\n`)
    }
    process.stdout.write('\nharness doctor\n')
    process.stdout.write(`  components: ${(manifest?.components || []).length}  errors: ${errs.length}  warnings: ${warns.length}\n\n`)
    if (errs.length) { process.stdout.write('ERRORS (drift — fail-closed)\n'); errs.forEach(print); process.stdout.write('\n') }
    if (warns.length) { process.stdout.write('WARNINGS (known gaps)\n'); warns.forEach(print); process.stdout.write('\n') }
    process.stdout.write(errs.length ? 'RESULT: DRIFT\n' : 'RESULT: OK (clean against manifest)\n')
  }

  process.exitCode = findings.some(f => f.severity === 'ERROR') ? 1 : 0
}

if (import.meta.url === `file://${process.argv[1]}`) main()
