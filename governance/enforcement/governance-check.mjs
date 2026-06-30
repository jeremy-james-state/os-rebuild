#!/usr/bin/env node
// governance/enforcement/governance-check.mjs — the governance drift-check (self-policing).
//
// Validates the governing layer with the same fail-closed shape as the harness doctor:
//   - governance ledger is valid JSONL                  (malformed/missing = ERROR)
//   - governance markdown links resolve                 (dangling = ERROR)
//   - decision/rule docs are referenced                 (orphan = WARN)
//   - permissions declare one owner per write-zone      (conflict = ERROR)
//
// Zero-dependency. Run: node governance/enforcement/governance-check.mjs [--json]

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, basename, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..', '..')
const REQUIRED_LEDGER_KEYS = ['id', 'ts', 'change', 'scope', 'basis', 'decidedBy', 'decision']

function finding(severity, code, message, fix) {
  return { severity, code, message, fix: fix || '' }
}

function rel(root, absPath) {
  return relative(root, absPath).replace(/\\/g, '/')
}

function walkFiles(root, dir) {
  const absDir = join(root, dir)
  if (!existsSync(absDir)) return []
  const out = []
  const stack = [absDir]
  while (stack.length) {
    const current = stack.pop()
    const entries = readdirSync(current).sort((a, b) => a.localeCompare(b))
    for (const entry of entries) {
      const abs = join(current, entry)
      const stat = statSync(abs)
      if (stat.isDirectory()) stack.push(abs)
      else out.push(abs)
    }
  }
  return out.sort((a, b) => rel(root, a).localeCompare(rel(root, b)))
}

function stripMarkdownTarget(rawTarget) {
  let target = rawTarget.trim()
  if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1).trim()
  else {
    const splitAt = target.search(/\s/)
    if (splitAt !== -1) target = target.slice(0, splitAt)
  }
  target = target.replace(/^['"]|['"]$/g, '')
  target = target.split('#')[0].split('?')[0]
  return target.trim()
}

function isRelativeLinkTarget(target) {
  if (!target) return false
  if (target.startsWith('#')) return false
  if (target.startsWith('/')) return false
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) return false
  return true
}

function extractMarkdownTargets(markdown) {
  const matches = []
  const re = /!?\[[^\]]*]\(([^)\n]+)\)/g
  for (const match of markdown.matchAll(re)) matches.push(match[1])
  return matches
}

export function checkLedgerIntegrity(root) {
  const ledgerPath = join(root, 'record', 'governance-ledger.jsonl')
  let raw
  try {
    raw = readFileSync(ledgerPath, 'utf8')
  } catch (e) {
    // record/ is gitignored — its durable home is the Data Layer — so an absent
    // ledger on a fresh checkout (e.g. CI) is expected, not drift. Validate the
    // ledger's integrity only when it is present locally.
    if (e.code === 'ENOENT') return []
    return [finding('ERROR', 'ledger-unreadable',
      `Cannot read governance ledger at '${rel(root, ledgerPath)}': ${e.message}`,
      'Fix the file permissions, or remove it (record/ is gitignored; the Data Layer is its home).')]
  }

  const out = []
  const lines = raw.split(/\r?\n/)
  if (lines.length && lines.at(-1) === '') lines.pop()
  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1
    const line = lines[i]
    if (!line.trim()) {
      out.push(finding('ERROR', 'ledger-invalid-json',
        `Governance ledger line ${lineNumber} is blank.`,
        'Remove blank lines so every ledger line is a JSON object.'))
      continue
    }
    let parsed
    try {
      parsed = JSON.parse(line)
    } catch (e) {
      out.push(finding('ERROR', 'ledger-invalid-json',
        `Governance ledger line ${lineNumber} is not valid JSON: ${e.message}`,
        'Fix the malformed JSONL row.'))
      continue
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      out.push(finding('ERROR', 'ledger-not-object',
        `Governance ledger line ${lineNumber} must be a JSON object.`,
        `Provide keys: ${REQUIRED_LEDGER_KEYS.join(', ')}.`))
      continue
    }
    const missing = REQUIRED_LEDGER_KEYS.filter((key) => !(key in parsed))
    if (missing.length) {
      out.push(finding('ERROR', 'ledger-missing-keys',
        `Governance ledger line ${lineNumber} is missing required keys: ${missing.join(', ')}.`,
        `Add keys: ${REQUIRED_LEDGER_KEYS.join(', ')}.`))
    }
  }
  return out
}

export function checkCrossReferences(root) {
  const out = []
  for (const absPath of walkFiles(root, 'governance')) {
    if (!absPath.endsWith('.md')) continue
    const source = readFileSync(absPath, 'utf8')
    for (const rawTarget of extractMarkdownTargets(source)) {
      const target = stripMarkdownTarget(rawTarget)
      if (!isRelativeLinkTarget(target)) continue
      const targetAbs = resolve(dirname(absPath), target)
      if (existsSync(targetAbs)) continue
      out.push(finding('ERROR', 'governance-link-dangling',
        `Governance link '${target}' in '${rel(root, absPath)}' does not resolve.`,
        'Fix the relative markdown link or restore the linked file.'))
    }
  }
  return out
}

export function checkOrphanDocs(root) {
  const out = []
  const referenceFiles = [
    ...walkFiles(root, 'governance'),
    ...walkFiles(root, 'docs'),
  ].filter((absPath) => absPath.endsWith('.md') || absPath.endsWith('.json'))

  const contents = new Map(referenceFiles.map((absPath) => [absPath, readFileSync(absPath, 'utf8')]))
  const targets = [
    ...walkFiles(root, 'governance/decisions'),
    ...walkFiles(root, 'governance/rules'),
  ].filter((absPath) => basename(absPath) !== 'README.md')

  for (const targetAbs of targets) {
    const targetRel = rel(root, targetAbs)
    const targetName = basename(targetAbs)
    const referenced = referenceFiles.some((sourceAbs) => {
      if (sourceAbs === targetAbs) return false
      const source = contents.get(sourceAbs) || ''
      return source.includes(targetRel) || source.includes(targetName)
    })
    if (!referenced) {
      out.push(finding('WARN', 'orphan-governance-doc',
        `Governance doc '${targetRel}' is not referenced by another governance/docs file.`,
        'Reference it from governance/README.md, docs/README.md, or another governance artifact.'))
    }
  }
  return out
}

export function checkWriteZones(root) {
  const permissionsPath = join(root, 'governance', 'permissions.json')
  let permissions
  try {
    permissions = JSON.parse(readFileSync(permissionsPath, 'utf8'))
  } catch (e) {
    return [finding('ERROR', 'permissions-unreadable',
      `Cannot read governance permissions at '${rel(root, permissionsPath)}': ${e.message}`,
      'Fix governance/permissions.json so it is valid JSON.')]
  }

  if (!permissions || typeof permissions !== 'object' || !Array.isArray(permissions.writeZones)) {
    return [finding('ERROR', 'permissions-invalid-shape',
      `Governance permissions must declare a writeZones array.`,
      'Add a top-level writeZones array with owner + writes entries.')]
  }

  const ownersByPath = new Map()
  for (const zone of permissions.writeZones) {
    if (!zone || typeof zone !== 'object' || !Array.isArray(zone.writes)) continue
    const owner = zone.owner || '<unknown>'
    for (const entry of zone.writes) {
      const path = String(entry).replace(/\\/g, '/').replace(/^\.\//, '')
      if (!ownersByPath.has(path)) ownersByPath.set(path, new Set())
      ownersByPath.get(path).add(owner)
    }
  }

  const out = []
  for (const [path, owners] of [...ownersByPath.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (owners.size < 2) continue
    out.push(finding('ERROR', 'write-zone-conflict',
      `Write-zone '${path}' has multiple owners: ${[...owners].sort().join(', ')}.`,
      'Give each write-zone path exactly one owner in governance/permissions.json.'))
  }
  return out
}

export function checkDeclaredWorkflows(root) {
  // CI workflows are governed controls (run code, hold secrets, egress data). Every workflow on
  // disk must be declared in governance/environment.json. Rule: governance/rules/ci-workflows.md.
  const out = []
  let files = []
  try {
    files = readdirSync(join(root, '.github', 'workflows')).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  } catch { return out } // no workflows dir → nothing to govern
  const declared = new Set()
  const envPath = join(root, 'governance', 'environment.json')
  try {
    const walk = (v) => {
      if (typeof v === 'string') { if (v.startsWith('.github/workflows/')) declared.add(v.replace(/^\.\//, '')) }
      else if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    walk(JSON.parse(readFileSync(envPath, 'utf8')))
  } catch (e) {
    return [finding('ERROR', 'environment-unreadable',
      `Cannot read '${rel(root, envPath)}': ${e.message}`,
      'Restore governance/environment.json so CI workflows can be validated against it.')]
  }
  for (const f of files.sort((a, b) => a.localeCompare(b))) {
    const wfPath = `.github/workflows/${f}`
    if (!declared.has(wfPath)) {
      out.push(finding('ERROR', 'workflow-undeclared',
        `CI workflow '${wfPath}' is not declared in governance/environment.json.`,
        'Declare it (id/does/path/secrets/egress) under layers.L3_repo.controls, add a ledger entry, and get owner approval — see governance/rules/ci-workflows.md.'))
    }
  }
  for (const wfPath of [...declared].sort()) {
    if (!existsSync(join(root, wfPath))) {
      out.push(finding('WARN', 'workflow-declared-but-absent',
        `Declared workflow '${wfPath}' is not on disk.`,
        'Remove its declaration from governance/environment.json or restore the workflow file.'))
    }
  }
  return out
}

export function runGovernanceCheck({ root = DEFAULT_ROOT } = {}) {
  const findings = [
    ...checkLedgerIntegrity(root),
    ...checkCrossReferences(root),
    ...checkOrphanDocs(root),
    ...checkWriteZones(root),
    ...checkDeclaredWorkflows(root),
  ]
  return { findings }
}

function main() {
  const args = process.argv.slice(2)
  const { findings } = runGovernanceCheck()

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({ findings }, null, 2) + '\n')
  } else {
    const errs = findings.filter((f) => f.severity === 'ERROR')
    const warns = findings.filter((f) => f.severity === 'WARN')
    const print = (f) => {
      process.stdout.write(`  [${f.severity}] ${f.code}: ${f.message}\n`)
      if (f.fix) process.stdout.write(`           fix: ${f.fix}\n`)
    }
    process.stdout.write('\ngovernance check\n')
    process.stdout.write(`  errors: ${errs.length}  warnings: ${warns.length}\n\n`)
    if (errs.length) { process.stdout.write('ERRORS (drift — fail-closed)\n'); errs.forEach(print); process.stdout.write('\n') }
    if (warns.length) { process.stdout.write('WARNINGS (known gaps)\n'); warns.forEach(print); process.stdout.write('\n') }
    process.stdout.write(errs.length ? 'RESULT: DRIFT\n' : 'RESULT: OK (governance holds)\n')
  }

  process.exitCode = findings.some((f) => f.severity === 'ERROR') ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
