# Vocabulary — one meaning each

> The canonical naming system for the harness. Every term here has exactly one
> meaning. New code and docs use these words as defined; the registry/contract
> schema (Stage 2) is built on them.

## The ladder (substrate)

`function → module (any .mjs with exports) → script (an entry module) → component (a declared script with a schema row)`

A script may be `.mjs` (logic) or `.sh` (**OS/git boundary only**).

## Process types (these are the folders)

| Type | What |
|---|---|
| **orchestrator** | a loop that owns the tick: sorts work, schedules, dispatches |
| **runner** | a one-shot executor that runs to an `exit` |
| **service** | an always-up process |
| **hook** | a *lifecycle hook*: code that fires on a Claude Code / git event (not a React hook) |
| **library** | plumbing, imported by others (not a process) |

## Derived roles (metadata on a runner — not folders)

| Role | = a runner that… |
|---|---|
| **agent** | an orchestrator dispatches (LLM-driven; AI sense, not `http.Agent`) |
| **command** | has `triggers: request` |
| **query** | has `writes: []` (read-only) |
| **store** | = **repository**: the sole writer/owner of a persistent table |

## Named components

- **scheduler** = the orchestrator (the loop).
- **estimator** = a runner it consults (scores work items).

## System of record & wiring

| Term | Meaning |
|---|---|
| **registry** | every component + schema + health (`registry.json`) |
| **contract** | a component's input/output/exit + reads/writes (co-located, mandatory) |
| **wiring** | the trigger as producer → consumer: A produces to a location, B consumes it |
| **handler** | the function a lifecycle hook runs (standard JS). A component is never "a handler" |
| **record** | the append-only log; supersede, never delete. Runtime streams are **gitignored** (durable home = the Data Layer); the **governance ledger stays tracked** (audit trail). Shape: `record/SCHEMA.md` |
| **run** | one job claim (use **run**, not "job"); the run queue sequences them |
| **procedure** | a governance gate / playbook (renamed from "skill"). **Split by part:** the playbook/gate → `governance/procedures/`; the runnable step → a `command` in `harness/`; attached evidence → `record/` / the Data Layer |
| **mode** | the harness's operating stance: `observe` / `build` / `gated` |
| **blueprint** | the harness's canonical end-to-end **shape** (`manifest.sequence`: session→idea→understand→shape→execute→assure→ship→observe) — the testable shape the doctor checks |
| **chain** | the build-pipeline **stages** (idea→pre-frame→…→deploy→monitor) that the blueprint wraps; each stage is an evidence gate |

## Platform primitives (Claude Code provides; the harness fills them)

`hook` (event) · `MCP tool` · `subagent` · `skill` (`SKILL.md`) · `plugin` · `permission-mode` · `settings`

## Aligned with standard JS (kept as-is)

`service` · `registry` · `schema` · `contract` · `dispatcher` · `reducer` · `queue` · `module` · `function`

## The closed-loop pieces

| Piece | type | reads | writes |
|---|---|---|---|
| **extractor** | runner (`triggers: event`) | every message | `record/signals` |
| **classifier** | runner | signals | `signal.type/confidence/target` |
| **router** | orchestrator | classified signals | dispatch + flags |
| **signal store** | store (append-only) | — | owns `record/signals` |
| **reconciler** | hook (SessionStart sweep) + orchestrator tick | signals | incidents for limbo |
