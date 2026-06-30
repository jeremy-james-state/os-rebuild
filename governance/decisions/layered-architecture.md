# Decision: The Layered Architecture (the capstone map)

> The top-level shape of the system: **three layers, two gates, one loop.** Every other
> decision is a detail page under this one. Normative. Detail pages:
> [`enforcement-points.md`](enforcement-points.md) (the gates), [`data-layer.md`](data-layer.md)
> (the tables + traceability), [`component-model.md`](component-model.md) (what a component is),
> [`manifest-registry.md`](manifest-registry.md) (the definition's schema + versioning),
> [`platform-home.md`](platform-home.md) (**OPEN:** where the execution layer runs).

## The whole system in one frame

```
GOVERNANCE LAYER  —  the harness DEFINITION
  component types (orchestrator · runner · service · hook · library)
  + manifest/registry + contracts + rules/principles
        │
        ▼   GATE #1 — the commit gate (doctor-green + merge)
        │   promotes one gated version to BE the running instance
        │
EXECUTION LAYER  —  a running INSTANCE of the definition
  the pinned checkout
  + the ORCHESTRATOR running the LOOP (extract → classify → route → act → outcome → reconcile)
  + the runners/agents it dispatches  + hooks
        │
        ▼   GATE #2 — the write hooks (table-scoped sole-writer)
        │   fires on every write the loop produces
        │
DATA LAYER  —  the tables
  record/ (truth)  →  state/os.db (projection)
        ▲
        └─ contracts authored in governance, projected DOWN read-only so Gate #2 is fast
           (the governance-ledger is the one stream homed UP in governance — the audit bridge)
```

## The three layers

| Layer | Is | Holds | Changes |
|---|---|---|---|
| **Governance** | the harness **definition** | component types, manifest/registry, contracts, rules/principles | rarely, by a human, through Gate #1 |
| **Execution** | a running **instance** of the definition | the pinned checkout + the orchestrator running the loop + runners + hooks | continuously (it's *doing the work*) |
| **Data** | the **tables** | `record/` (append-only truth) → `state/os.db` (rebuildable projection) | every turn (free, within the write hooks) |

The relationship is **Definition → Instance → Substrate.** The governance layer *defines* what the
harness is; the execution layer is the *version that actually runs* (the pinned checkout); the
`.mjs` and the tables are *substrate* the definition governs — present in both but never themselves
the harness (see [`enforcement-points.md`](enforcement-points.md), "harness vs substrate").

## The two gates (one per layer boundary)

The gates **are** the membranes between the layers — they are the harness (governance +
enforcement; [`enforcement-points.md`](enforcement-points.md)).

- **Gate #1 — the commit gate** (Governance → Execution): `doctor`-green + human merge decide what
  code/definition becomes the running version. **Code is gated on the way in.** *Admission folds in
  here* — admitting a candidate is a gated manifest merge, not a third gate. **Built**, merge-blocking.
- **Gate #2 — the write hooks** (Execution → Data): only a table's sole writer may write it, checked
  at the moment of write. **Data is gated at the moment of write.** Runtime hook still to be built;
  the gate-time half (schema-validated `writes` declarations) lands with this decision.

## The one loop (the execution engine)

The execution layer is driven by the **orchestrator** running the closed loop:
**extract → classify → route → act → outcome → reconcile.** The reconciler sweeps for any signal
with intent but no terminal outcome, so **silence is impossible**. Every write the loop produces
passes Gate #2. The orchestrator is itself a defined component (`type: orchestrator`) — *defined* in
governance, *run* in execution: the model does not special-case its own engine.

## Contracts: authored up, projected down (the integrity rule)

A contract's **truth lives in the governance layer** (git-tracked, gated). A **read-only projection**
is loaded *down* into the runtime so Gate #2 can authorize writes at speed — the contract never
phones home, and is **never authored in the data layer** (that would move the constitution into the
mutable layer). It is the same truth→projection law the data already uses:

| Truth (governed) | Projection (fast, rebuildable) |
|---|---|
| `record/*.jsonl` | `state/os.db` tables |
| repo contracts / `permissions.json` | runtime authorization table (who-writes-what) |

Corrupt a projection and you rebuild it from truth. **The repo is always the source of truth for the
rules.**

## Versioning the definition (two axes, one pin)

The harness definition = **{manifest + registry + contracts}, each schema'd**, versioned on two axes:

- **`manifestVersion` / schema version** — *the shape* of a valid definition (the meta-level: the
  definition of the definition). Changes rarely. Schemas: `harness/manifest.schema.json`,
  `harness/registry.schema.json`, `harness/contract.schema.json` — the doctor **validates the
  definition against them** (a violation is drift = ERROR).
- **`harnessVersion`** — *the content* (the boundary itself). Bumps on every state change per the
  semver rule in the manifest's `versioning` block; logged in `harness/CHANGELOG.md`.

The **execution layer pins a `harnessVersion`** — "the version that runs" = the pinned checkout, the
output of Gate #1. And every runtime row is **stamped with the `harnessVersion` + `codeSha` it was
produced under**, so the data layer can always answer *"which version of the harness produced this?"*
— versioning meets traceability (the four-tuple `session · run · call · branch`, plus the version).

## Status (what's built vs open)

- **Gate #1:** built, merge-blocking.
- **The definition schema:** complete — manifest/registry/contract schemas exist and the doctor now
  **enforces** them (`governance/enforcement/schema-validate.mjs` + `checkSchemas`).
- **Version stamping:** the `signals` stream now records `harnessVersion` + `codeSha`; the
  `run-store`/`work-store` inherit the same stamp.
- **Gate #2 runtime hook:** **OPEN** — declarations are schema-validated at Gate #1; the at-write-time
  table-scoped hook lands with the data-layer stores ([`enforcement-points.md`](enforcement-points.md)).
- **Execution-layer home:** **OPEN** — [`platform-home.md`](platform-home.md).
