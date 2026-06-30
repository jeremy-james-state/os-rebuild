# Rule: Harness Admission

> Nothing becomes part of the harness by being written. A unit of code is **admitted**
> to the harness only after it passes this gate. Until then it is a **candidate** — it
> may exist and run in `harness/sandbox/`, but it is **not the harness**.
> Owner: `ov`. Enforcement: process now. The harness file is split (`manifest.json` rails +
> `registry.json` rows, merged by the `doctor`); the remaining doctor gate — *requiring* a
> co-located `contract.json` — is deferred until components leave `planned`. Normative
> reference: [`../decisions/component-model.md`](../decisions/component-model.md).

## Why

v1's failure was building before defining — code accreted into the harness with no
gate, and the result was ungovernable sprawl. The harness file (`harness/manifest.json`)
is the boundary: *a component is in the production harness iff it is declared there.*
So **populating that file is promotion**, and promotion is the one step a session may
not take on its own.

## The five steps (Located · Registered · Contracted · Green · Admitted)

A candidate advances through all five, in order. The first four a session may do; the
fifth is the human's.

1. **Located** — the code lives in `harness/sandbox/<name>/`, never in `harness/core/`
   or a type-folder. Sandbox = "exists and may run, but is not the harness."
2. **Registered** — recorded as a candidate (lightweight: `governance/candidates.md`)
   with its location, what it does, and its current step. Visible, not hidden.
3. **Contracted** — a co-located `contract.json` declaring `input`/`output`/`reads`/
   `writes`/`triggers`/`provenance`/`config`. The shape is fixed before it is trusted.
4. **Green** — its own tests pass, and the three enforcement checks (doctor,
   governance-check, structure-check) stay clean with it present.
5. **Admitted** — **a human reviews and approves**, and only then is it promoted:
   moved into its type-folder, declared in the harness file (`manifest.json` /
   `registry.json`), and recorded in `record/governance-ledger.jsonl`. This is the
   only step that touches the harness boundary.

## The hard line

- A session may take a candidate to **Green**. A session may **not** take step 5.
- Admission is **never** implied by code existing, running, or being wired as a hook.
  A wired candidate is still a candidate.
- Promotion is the *only* path into `harness/core/`, a type-folder, or the harness file.

## Exit

A candidate is either **admitted** (promoted, this rule satisfied) or **withdrawn**
(removed from `harness/sandbox/` and struck from `governance/candidates.md`). It does
not linger half-in.
