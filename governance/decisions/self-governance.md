# Decision: Governance Governs Itself

> The governing layer is held to the **same rigor it imposes.** Governance has its own
> codebase (`governance/`); whether it sits *in* or *above* the harness, it is checked,
> not merely read. Normative. The recursive closure of *bound to be free* — the binder
> is bound too.

## The gap (today)

The `doctor` validates `harness/` and **skips `governance/`** (it is in the doctor's
`KNOWN_NON_HARNESS` set). So governance is gated only by **process** — the Model A PR +
`doctor` + review — and by **no content check at all.** A malformed, dead, or
self-contradictory governance artifact passes CI. The thing that enforces rigor on the
harness exempts itself. That is exactly the smell we keep naming: *an unchecked governor
is not governed.*

## The rule

Every artifact under `governance/` is subject to a structural check with the **same
standing as the `doctor`**, run at the **same gate** (CI, required before merge). Drift
in governance is caught where drift in the harness is caught.

## What the governance check validates (the bar)

- **No orphans / dead docs** — every decision/rule is reachable (referenced by an index
  or another artifact); nothing rots unlinked.
- **Rules pass the governability test** — every file under `governance/rules/` declares
  Bound · Observable · Triggerable · Clear Exit · Tested (or is explicitly marked
  `not-yet`, never silently absent).
- **Ledger integrity** — `record/governance-ledger.jsonl` is append-only and
  well-formed; every governance change has an entry.
- **One authority, no contradiction** — `permissions.json` is consistent with
  `write-zones.md`; a path has exactly one owner.
- **Cross-references resolve** — no dangling links between decisions/rules.
- **Classification holds** — normative content lives in `governance/`, descriptive in
  `docs/` (the doc-discipline rule), not mixed.

## Where governance sits (settled)

Governance is **the OS around the harness**, not inside `harness/` — but it carries the
**same level of rigor**. "Outside the executing core" never means "less governed." The
boundary (`docs/BOUNDARY.md`) separates *what executes* from *what governs*; this
decision says both are **checked to the same standard.**

## Status

- **Defined:** this decision.
- **Mechanism (planned, not built):** a **governance check** in
  `governance/enforcement/` (or an extension of it) that runs the bar above in CI. To be built on explicit
  confirmation, contract-first like any component.
- **Enforced when:** the governance check is wired into CI as a required gate — then a
  governance artifact that fails the bar cannot reach `main`, exactly as a harness drift
  cannot.

**Owner:** governance. **Basis:** decided 2026-06-30 — *the binder must be bound.*
Cross-refs: `component-model.md`, `governability.md`, `doc-discipline.md`. Ledger
`gov-2026-06-30-019`.
