# Data Layer Substrate — Design Pass (decision pending)

> What the store actually *is*, decided before any signal is pushed. Descriptive
> design analysis; the normative choice lands in `governance/decisions/data-layer.md`
> + the ledger once you pick. Driven by two stated constraints:
> **(a) it must be viewable / queryable — "a db is far more observable"; and
> (b) no write delay — the Supabase latency worry.**

## Requirements (the acceptance criteria the store must pass)

From `governance/decisions/data-layer.md` + the governability test:

| # | Requirement |
|---|---|
| R1 | **Append-only / supersede-never-delete** — an immutable audit trail. |
| R2 | **Four-tuple** (`session · run · call · branch`) on every row. |
| R3 | **Sole-writer** per stream/table. |
| R4 | **Traceable** — project a work-item end-to-end; reduce to current state. |
| R5 | **Observable / viewable** — you can *see and query* what landed (your point). |
| R6 | **Survives the ephemeral container** — persistence beyond this session. |
| R7 | **Stays governable** — truth must not move to an ungoverned authority outside git. |
| R8 | **No write-path latency** — appending a signal must not block on a network (your worry). |

## The reframe that dissolves the tension: events vs. read-model

This is event-sourcing. Separate **where truth lives** from **how you view it**:

- **The event log = the truth.** Append-only `record/*.jsonl`, written locally and
  instantly, version-controlled in git. Satisfies R1, R2, R3, R6, R7, **R8** (a local
  file append has no network in the path).
- **The DB = a projection / read-model.** Built *from* the log, for querying and
  viewing. Satisfies R4, R5. It is **rebuildable and disposable** — not an authority,
  so it never violates R7. If it's lost, replay the log.

So the substrate question is **not "where does truth live"** (answer: the local log)
**— it's "what do we project the log into so you can view it."**

## Options, scored against R5 (viewable) and R8 (no write delay)

| Option | Viewable / queryable (R5) | Write latency (R8) | In-boundary (R7) | Survives container (R6) |
|---|:--:|:--:|:--:|:--:|
| **jsonl only** | weak — grep/reduce by hand | none ✓ | yes ✓ | via git ✓ |
| **jsonl truth + local SQLite projection** | **strong — real SQL, local viewer** | **none ✓ (local file)** | yes ✓ | log via git; DB rebuilt ✓ |
| **jsonl truth + Supabase/Postgres projection** | strong + remote dashboards | none **if async** / **bad if on write-path** | DB is external ⚠ | yes (managed) ✓ |
| **Supabase as the source of truth** | strong | **delay on every write ✗** | external authority ✗ | yes |

## Recommendation

**jsonl event-log (truth) + local SQLite (the queryable read-model).** It is the only
row that scores well on *both* your constraints: a real DB you can view and query
(R5), with zero write-path latency because the hot path is a local append and SQLite
is a local file (R8). It stays fully in-boundary and local-first (R7), and the DB is
rebuildable from the log so it's never an authority you can lose.

**Supabase/Postgres is not rejected — it's repositioned.** It becomes an *optional
async downstream sink* (remote dashboards, cross-container, multi-agent), fed from
the log out-of-band. Because it's never on the ingestion path, **its write latency
never touches a signal.** Graduate to it only at a bounded trigger: the first time you
need to view the data from outside this container, or more than one writer exists.

## Decision needed from you

1. Confirm the **event-log + projection** model (truth in `record/*.jsonl`, DB is a
   derived read-model).
2. Pick the **first projection**: **local SQLite** (recommended — viewable + no delay),
   or go straight to **Supabase** as the projection if you want remote viewing now and
   accept it's async/eventually-consistent.

Nothing is built until you choose; then the store ships with a contract that passes
Bound · Observable · Triggerable · Clear Exit.
