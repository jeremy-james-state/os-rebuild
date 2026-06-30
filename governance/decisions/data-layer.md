# Design: Data Layer & Traceability

> Where the harness writes, who may write it, and how every action stays
> traceable. Binds behaviour; the store components built in Stage 2 conform to it.
> Vocabulary: `docs/VOCABULARY.md`.

## Two stores

| Store | What | Tracked? |
|---|---|---|
| **`record/`** | append-only **memory**: the durable log of everything that happened | git-tracked, never edited |
| **`state/`** | rebuildable **projections** (SQLite): fast, queryable views derived from `record/` | gitignored, disposable |

`state/` is always rebuildable from `record/`. If `state/` is deleted, a reducer
replays `record/` to rebuild it. The truth lives in `record/`; `state/` is a lens.

## Sole-writer rule (the store discipline)

**One store owns one table — and is its only writer.** A `store` (= repository) is
the sole writer of its table; everything else reads. No table has two writers. This
is the disjoint-write check: overlapping writers must be the same store, or they
serialise. It is what makes "who wrote this" always answerable.

## Provenance — the four-tuple, on every row

`session · run · call · branch` — *which session, which job, in what order, against
which code.* Plus:
- **supersede, never delete** — corrections append a new row with `supersedes_id`.
- **the run record is the spine** — one row per run at dispatch
  (`session_id, run_id, branch, worker_id, job_type, started_at, completed_at`).
- **a run** = one job claim (use *run*, not "job"); the run queue sequences them.

## Trace context (OpenTelemetry methodology)

Beyond the four-tuple, a **trace context is propagated across every hop** — door →
router → component → store — so a single action (a click, a push, an agent run) is
followable end-to-end as one trace. No hop is untraced; no outcome is silent.

## Initial tables

**`record/` (append-only):**

| Table | Owner (store) | Holds |
|---|---|---|
| `governance-ledger` | governance store | every governance change (propose/decide/apply) |
| `runs` | run store | one row per run (the spine) |
| `signals` | signal store | every input from a door (extractor writes here) |
| `evidence` | evidence store | tests, scores, adversarial reviews — attached to what they verify |
| `incidents` | incident store | failures, limbo signals raised by the reconciler |

**`state/` (rebuildable projections):** current work-state · the run queue ·
the observation log · the open-signals view (the "I don't know" pile).

## The closed loop (every input → terminal outcome)

`extractor → classifier → router → completed | unknown | failed`, and a
**reconciler** sweeps for any signal with an intention but no terminal outcome and
raises an incident. Silence is impossible. (Pieces + reads/writes:
`docs/VOCABULARY.md`; full model: `docs/architecture/harness-observability.md`.)

## Why this matters

Traceability is the point: every door-action becomes a stamped `run` + `signals`,
routed to an outcome, durable in `record/`, queryable in `state/`, followable as one
trace. That is what lets the system be governed, audited, and eventually trusted to
run itself.
