# The Harness Boundary — locked

> The certain edge of the system. Locked 2026-06-30. This is the answer to
> "what *is* the harness, and where does it end."

## The rule (one line)

**The Harness = the `harness/` folder.** If it executes, it's the harness. If the
harness reads it, writes it, or a human reads it, it's the OS *around* the harness —
not the harness itself.

## In the harness

`harness/` — all executing code, organized by **type** (`orchestrators/`,
`runners/`, `services/`, `hooks/`, `lib/`), each file a **registered component**
with a contract. **"Frozen" (the safety spine — dispatcher, write-fence, gates) is
a component _property_, not a folder** — frozen components live in their normal
type-folders and are protected by CODEOWNERS + the doctor.

## Around the harness (the OS)

| Folder | Role | Why it's not the harness |
|---|---|---|
| `governance/` | the **law** the harness enforces (rules, agents-as-data, permissions) | data it reads; it doesn't execute |
| `docs/` | human knowledge (charter, principles, definitions, design references) | for people, not run |
| `record/` | the harness's append-only **memory / evidence** | output, not the machine — runtime streams **gitignored** (durable home = the Data Layer); the **governance ledger stays tracked** (audit trail) |
| `state/` | rebuildable **projections** (gitignored) | derived; safe to delete — the Data Layer |
| *(separate repo)* [`os-archive`](https://github.com/jeremy-james-state/os-archive) | the inherited **past** (prior repos, expanded) | frozen context, not run — its own repo, added on demand |

## The four layers (framing)

The repo reads as four layers around one spine. (Canonical glossary:
[`docs/VOCABULARY.md`](VOCABULARY.md).)

| Layer | Where | What |
|---|---|---|
| **method** | `docs/` | how we work — principles, definitions, procedures, templates |
| **governance** | `governance/` | the law (rules, decisions, permissions) **+ its enforcement** (`governance/enforcement/`: doctor, governance-check, structure-check) |
| **operational** | `harness/` | the executing code (the dispatcher/spine are frozen components *here*, not a separate tier) |
| **evidence / memory** | **the Data Layer** | the append-only log + projections; `record/` runtime streams + `state/` are **gitignored** repo-side mounts (the `governance-ledger` is the one tracked exception — the audit trail) |

## The test

> *In `harness/` → it's the harness. Outside `harness/` → it's something the
> harness reads, writes, or inherits.*

One folder is the edge. Anything claiming to be "the harness" that lives outside
`harness/`, or any executing code that lives outside `harness/`, is a boundary
violation the doctor (`governance/enforcement/doctor.mjs`) must flag.

---

## Entry & Routing — the dynamic boundary

The static boundary is *which folder*. The dynamic boundary is *how the outside
gets in and reaches code* — and it's the more important half: **nothing executes
except through a known door, routed by one orchestrator.**

### The doors (the outward surface)

The only ways in. Each is a platform primitive the harness fills; each emits a
**signal** the moment it fires:

- **Claude Code hooks** — `SessionStart`, `UserPromptSubmit`, `PreToolUse`
- **MCP tools / commands** — request-triggered
- **Scheduled / loop ticks** — time-triggered
- **Git events** — push / PR
- **The interface** — a UI action (a button click), as the system grows

### The router (the orchestrator) — one dispatcher, no side-doors

Every signal flows **`input → intention → outcome`** through the **single
orchestrator**. It classifies (with confidence), routes to a component, or flags
`unknown` to the owner. **No component fires except via a declared trigger routed
here.** A button never has a private path to code; a hook never calls a component
directly. *No side-doors* is what makes the boundary real and governable.

### Closed loop — silence is impossible

Every input reaches a terminal outcome — **completed / unknown / failed** — or a
**reconciler** sweeps for anything with an intention but no outcome and raises it.
(Per `docs/architecture/harness-observability.md`.)

### Traceability — OpenTelemetry methodology + traced decisions

- Every signal carries the **four-tuple** provenance (`session · run · call ·
  branch`) plus a **trace context propagated across every door → router →
  component hop** (OpenTelemetry methodology), so one action is followable
  end-to-end.
- Human-in-the-loop decisions pass through a **traced decision surface (a modal)**
  — every approve / refine / reject is captured with full provenance into
  `record/`. No decision is made off-record.

So the interface, the CLI, a push, and a schedule are all the same shape:
**door → traced signal → router → outcome** — fully observable, no silent failures.
This is built as the centerpiece of Stage 2 (the orchestrator) and Stage 3 (the
closed loop + traced decisions).
