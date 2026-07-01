# Rule: Harness Admission

> Nothing becomes part of the harness by being written. A unit of code is **admitted**
> only after it passes this gate. Until then it is a **candidate** — it may exist and
> run, but it is **not admitted**.
> Owner: `ov`. Enforcement: process + the checks. The harness spine is ONE file
> (`harness/manifest.json` — rails + the full component census; the former
> `registry.json` was merged in at the os-reshape P1). Lifecycle state is a **manifest
> field, decoupled from file location** — location alone never admits. Normative
> reference: [`../decisions/component-model.md`](../decisions/component-model.md).

## Why

v1's failure was building before defining — code accreted into the harness with no
gate, and the result was ungovernable sprawl. The manifest census is the boundary:
*a component is admitted iff its census row says so (state production/staging).*
So **flipping that state is promotion**, and promotion is the one step a session may
not take on its own. The manifest is CODEOWNERS-gated, so the flip is human-reviewed
by construction.

## Where candidates live (post-reshape geometry)

- **Apps** (userland workers): candidates live in `apps/_drafts/<name>/`. Admission
  moves the folder to `apps/<name>/` **and** flips its census state — both in one
  reviewed change. The doctor's containment check fails any `_drafts/` row claiming an
  admitted state (self-admission drift).
- **Kernel parts** (`harness/loop/`, `harness/guard/`): they live at their functional
  home with `state: candidate` in the census. Their admission is the reviewed census
  state flip alone — the location already matches the role (state ≠ location).

## The five steps (Located · Registered · Contracted · Green · Admitted)

A candidate advances through all five, in order. The first four a session may do; the
fifth is the human's.

1. **Located** — apps in `apps/_drafts/<name>/`; kernel parts in `harness/loop|guard/<name>/`
   with `state: candidate` in the census.
2. **Registered** — a census row in `harness/manifest.json` (state `candidate` or
   `sandbox`) + a line in `governance/candidates.md` with location, purpose, and step.
   Visible, not hidden.
3. **Contracted** — a co-located `contract.json` declaring `input`/`output`/`reads`/
   `writes`/`triggers`/`provenance`/`config`. The shape is fixed before it is trusted.
4. **Green** — its own tests pass, and the four checks (doctor, governance-check,
   structure-check, no-ghost-agent) stay clean with it present.
5. **Admitted** — **a human reviews and approves** the census state flip (+ the
   `_drafts/` move for apps), recorded in `record/governance-ledger.jsonl`. This is
   the only step that touches the admission boundary.

## The hard line

- A session may take a candidate to **Green**. A session may **not** take step 5.
- Admission is **never** implied by code existing, running, being wired as a hook, or
  living outside `_drafts/`. A wired candidate is still a candidate; a kernel-folder
  candidate is still a candidate.
- Promotion is the *only* path to an admitted census state.

## Exit

A candidate is either **admitted** (promoted, this rule satisfied) or **withdrawn**
(moved to `.system/bin/` with metadata — restorable — and struck from
`governance/candidates.md` + the census). It does not linger half-in.
