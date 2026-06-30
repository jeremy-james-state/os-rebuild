# Harness Architecture — Reference

**One line.** The harness *is* the running code; docs + governance data are inputs it uses.
GitHub `main` = source of truth · DBs = rebuildable projections · records are append-only.

## Everything is a component (no loose scripts)
Every runnable file in `harness/` is a **component** with a `type`, a `status`, and a `contract`.
- **script** = a file format (`.mjs` / `.py` / `.sh`) — *not* a category.
- **component** = a registered script (`registry.json` row + `contract.json`).
- A file nothing fires/imports and not explicitly `in-formation` → **RED**. Dead code can't hide.

## Types (= the folders)
| Type | What | Fires? |
|---|---|---|
| **orchestrator** | a loop that schedules + dispatches | loop |
| **runner** | one-shot executor (runs to an `exit`) | once / request |
| **service** | always-up process | event / request |
| **hook** | runs on a lifecycle event | event |
| **library** | plumbing, imported by others | n/a (imported) |

## Roles (derived from the schema — not folders)
- **agent** = a `runner` an orchestrator dispatches (LLM) · **command** = a `runner`, `triggers: request`
- **query** = a `runner`, `writes: []` · **store** = a `runner`/`service` that owns a table (sole writer = repository)
- **scheduler** = the orchestrator (the loop) · **estimator** = a runner it consults (scores work)

## Status
`wired` (actually fired/imported) · `in-formation` (parked: reason + expiry). **Neither = RED.**

## Component schema (`registry.json` + each `contract.json`)
```yaml
component:
  name:    string
  type:    orchestrator | runner | service | hook | library
  status:  wired | in-formation
  contract: { input: json_schema, output: json_schema, exit: predicate }  # exit: orchestrator/runner
  reads:   [table | path]        # consumes
  writes:  [table | path]        # produces (disjoint-write check)
  config:  [key]                 # reads, never changes
  triggers: loop | once | request | event
  provenance: bool               # stamps session_id / run_id / call_seq / branch
  # derived: role (agent|command|query|store), wiring (from producer→consumer graph)
```

## Folder structure
```
harness/            # the running code (folders = types)
  orchestrators/    runners/    services/    hooks/    lib/
  registry.json     # system of record: every component's schema + health
  map.md            # ≤100 lines, pointer-only
  tests/
  # each component = index.mjs|.py|.sh + contract.json + overview.md
governance/         # the law (policy DATA) + its enforcement
  decisions/  rules/  agents/  design/  permissions.json
  enforcement/      # the verifiers: doctor, governance-check, structure-check
docs/               # pure human docs (method: principles, definitions, procedures, templates)
record/             # append-only log — gitignored; durable home = the Data Layer
state/              # rebuildable projections + run queue — gitignored; the Data Layer
.claude/  .github/   # platform
```
> **The safety spine is not a folder.** The dispatcher, write-fence, and gates are
> **frozen components** that live in their normal `harness/` type-folders (`frozen: true`
> in the registry), protected by CODEOWNERS + the doctor. The *verifiers* that enforce
> the boundary (`doctor`, `governance-check`, `structure-check`) live in
> `governance/enforcement/`. "Frozen is a property, not a folder."

## Invariants (enforced by the structural test, not convention)
- One store owns one table (sole writer). · `record/` append-only is **structural** (supersede, never delete).
- `governance/` is schema-validated (malformed rule fails loud). · `map.md` is pointer-only.
- **Frozen is a property, not a folder**: spine components (dispatcher, write-fence, gates) stay in their `harness/` type-folders, protected by CODEOWNERS + the doctor; the verifiers live in `governance/enforcement/`. · Every component has a co-located, mandatory contract.
- A `.sh` lives only at the OS/git boundary; the spine stays `.mjs`; a `runner` may be `.py`.

## Modes (enforced by orchestrator + write-fence)
**observe** (read-only) · **build** (autonomous loop, lands via PR) · **gated** (writers halt for approval).

## Concurrency — *fan out to understand, serialise to change*
Parallel **reads** (isolated, funnel to the lead) · serial **writes** (one writer per path).
**Disjoint write-paths run in parallel; overlapping run in sequence** — = the write-zones.

## Provenance (four-tuple on every record row)
`session_id` · `run_id` · `call_seq` · `branch`. Supersession via `supersedes_id`, never delete.
The **run record** is the spine: one row per run at dispatch (`worker_id, job_type, started/completed`).

## Vocab ↔ standard JS (one meaning each)
`hook` = lifecycle hook (not React) · `store` = repository · `handler` = a hook's function ·
`worker` = a background runner (not a Node thread) · `agent` = AI sense · `module`/`function` = ordinary code.

## Platform primitives (Claude Code provides; the harness fills them)
`hook` (event) · `MCP tool` · `subagent` · `skill` (`SKILL.md`) · `plugin` · `permission-mode` · `settings`.
The harness's outward surface (hooks + MCP + agents + commands) is **plugin-shaped** → installable as one unit.
