# Harness Observability & the Closed Loop — Reference

**One line.** A dead component is a *structural* silent failure; a dropped signal is a *runtime* one — same
cure. **Every input reaches a terminal outcome, or a reconciler raises it.** Silence is impossible.

## The closed-loop contract
Every input becomes **(input → intention → outcome)**, and **outcome is never empty** — exactly one of:
- **completed** — classified, routed to a component, processed.
- **unknown** — "I don't understand" → flagged to the owner.
- **failed** — went somewhere, errored → flagged.

A **reconciler** sweeps for any signal with an intention but no terminal outcome and raises it.
(Generalizes the existing turn-ledger: open → must close → `turn-reconcile` flags orphans.)

## Provenance — the four-tuple on every record row
`session_id` · `run_id` · `call_seq` · `branch` → *which session, which job, in what order, against which code.*
Supersession via `supersedes_id` (append, never delete). The **run record** is the spine: one row per run at
dispatch (`session_id, run_id, branch, worker_id, job_type, started_at, completed_at`).

## Signal lifecycle
```
received     extractor writes the signal (four-tuple stamped)
  → classified   type + confidence + target
  → routed | flagged   orchestrator dispatches, OR flags "I don't know"
  → completed | failed   target processes it
  → (reconciler catches anything not terminal)
```

## Confidence routing — uncertainty is explicit, never a silent drop
- **high** → auto-route to the target component.
- **medium** → route + flag for review.
- **low** → don't guess; ask the owner.
The system states confidence + decision: *"0.9 correction → learning-governor"* vs *"0.4 — unknown, flagging for you."*

## Routes by type to its owner (and revives dead components)
| Signal type | → routed to |
|---|---|
| correction / feedback | `learning-governor` (already turns corrections into principles) |
| judgment | review store |
| request | work store |
| unknown | the owner |
Wiring **extractor → orchestrator → governor** builds the loop *and* closes `signal-extractor` + `learning-governor`.

## Pieces (mapped to the component schema)
| Piece | type | reads | writes |
|---|---|---|---|
| extractor | runner (`triggers: event`) | every message | `record/signals` |
| classifier | runner | signals | type / confidence / target |
| router | **orchestrator** | classified signals | dispatch + flags |
| signal store | **store** (append-only) | — | owns `record/signals` |
| reconciler | hook (SessionStart) + orchestrator tick | signals | incidents for limbo |

## Two locked design calls
1. **Classifier scores, orchestrator routes** — kept separate; swappable rules → LLM. ("estimator scores, scheduler dispatches.")
2. **The reconciler is the guarantee** — must be reliable / out-of-process; routing may be best-effort.

## Where you see it — the governance screen
Each pass reads the **open (unresolved) signals** + state + confidence + the run record. The screen shows:
**signals in → routed → resolved → flagged-unknown** (the pile waiting on you). The "I don't know" list is never hidden.
