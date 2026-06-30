# Governance Readiness Checklist

> The single view that answers: **"is the governance layer in place?"** Governance
> must be solid *before* the operational layer runs on top of it — the operational
> layer (signal → work-item → the agent chain) is where the value is, but it can
> only be trusted inside a governed boundary. Normative. The bar is below.

## Entry test (before a row exists)

A principle/rule/control earns a row below only if it passes the **Governability
Test** (`governance/decisions/governability.md`): it is **Bound** (machine condition,
or a judgement carrying basis + acceptance criteria), **Observable**, **Triggerable**,
has a **Clear Exit**, and is **Tested/Verified** (a repeatable test shows it both
rejects and allows). Fail it and the thing is advice in `docs/`, not a rail.

## The two layers

- **Governance layer** — the boundary, the rails, the record. What makes the system
  *bound* (and therefore free and trustworthy). **Must be in place first.**
- **Operational layer** — the work itself: extract a signal, create a work-item,
  trace it through clarify → scope → plan → build → test → deploy → monitor.
  Sits *inside* the governance layer. All components currently `planned`.

## The bar for "in place" — and what "enforced" actually means

A control is **In place** only when it is both **Defined** (a normative doc says
what it is) *and* **Enforced**. But "enforced" has tiers, and being honest about
which tier a control is at *is* the governance. **Enforced means a mechanism makes
it true automatically — on every relevant run — not that a human remembers to run a
check.** The ladder, strongest first:

| Tier | Symbol | Meaning |
|---|:--:|---|
| **Per-run** | ✅ | A hook makes it true on **every relevant run**; cannot be skipped. *Requires a hook — this repo has none yet.* |
| **Gated at merge** | 🔶 | Runs automatically on every PR (CI / CODEOWNERS). Catches it at the merge boundary, not during a session. |
| **On-demand** | 🔁 | The mechanism exists but only when someone invokes it (e.g. `node governance/enforcement/doctor.mjs`). |
| **By hand** | 🟡 | Goodwill — a human follows the rule. |
| **Defined only** | ⛔ | Written, no mechanism. |
| **Not defined** | — | — |

**The headline truth (2026-06-30): nothing here is `✅` per-run.** The strongest
tier present is `🔶` gated-at-merge (CI runs the doctor on every PR; CODEOWNERS
requires review). Per-run enforcement needs a **hook** (SessionStart / PreToolUse /
Stop) that runs the doctor every turn — and the env audit shows **this repo has no
hooks of its own.** So "true enforcement on every run" is a deliberate next step,
not something we have. Calling that out is the point of this page.

## Governance layer

| # | Control | Defined | Enforced | Where |
|---|---|:--:|:--:|---|
| G1 | **Boundary** (what is/isn't the harness) | ✅ | 🔶/🔁 | `docs/BOUNDARY.md`; doctor knows it, but only on PR / on-demand |
| G2 | **Drift-check / doctor** (the structural test) | ✅ | 🔶/🔁 | `governance/enforcement/doctor.mjs` — GREEN, but runs in CI / by hand, **not every run** |
| G3 | **Manifest + MD twin** (machine-readable shape, versioned) | ✅ | 🔶 | `harness/manifest.json` + `.md`, `CHANGELOG.md` (md-sync checked in CI) |
| G4 | **CI merge gate** (doctor + tests on every PR) | ✅ | 🔶 | `.github/workflows/ci.yml` — the strongest tier we have |
| G5 | **CODEOWNERS** (owner review at merge) | ✅ | 🔶 | `.github/CODEOWNERS` — *needs branch protection ON to bite* |
| G6 | **Component model** (registry + contract + type-folder) | ✅ | ⛔ | `governance/decisions/component-model.md` — contracts not yet required (Stage 2) |
| G7 | **Authority model** (capability, request, grant, escalate) | ✅ | ⛔ | `governance/decisions/authority.md` — no write-fence yet |
| G8 | **Write-zones** (path authority) | ✅ | 🔶 | `write-zones.md` + `permissions.json`; merge-gated via CODEOWNERS, no runtime write-fence |
| G9 | **Data layer / traceability** (append-only, four-tuple) | ✅ | ⛔ | `data-layer.md`; only `record/runs.jsonl` written, no store wired |
| G10 | **Governance pipeline** (propose → decide → apply → log) | ✅ | 🟡 | `docs/GOVERNANCE-PIPELINE.md`; ledger appended by hand |
| G11 | **Governance ledger** (every change recorded) | ✅ | 🟡 | `record/governance-ledger.jsonl` |
| G12 | **Branching** (Model A: PR + required `doctor` check + auto-delete) | ✅ | 🔁→🔶 | `branching.md` — standard flow with explicit deletion rules; enforced once the `main` ruleset is reconfigured (require PR + required `doctor` check), then verified by the first PR |
| G13 | **Doc-discipline** (classify before write; one authority) | ✅ | 🟡 | `governance/rules/doc-discipline.md` |
| G14 | **Environment registry** (what controls/hooks are running) | ✅ | 🟡 | `governance/environment.json` + `docs/CONTROLS-REGISTER.md`; audited by hand, no env-audit script |
| G15 | **Push / merge observability** (no silent push failure) | — | — | proposed: a wait-gate that halts until the PR is merged — closes the loop the human fears |

**Honest reading (2026-06-30):** branching moved to **Model A** (GitHub standard:
PR + required `doctor` check + auto-delete) — the gate is server-side and logged, but
**pending the `main` ruleset reconfiguration** it is not yet active. Once reconfigured
and proven by the first PR, G12 and G4 become a real `🔶` gated-at-merge spine.
Everything else is written but rests on goodwill. The moves that raise the floor:
1. **Turn on branch protection** on `main` → makes G4/G5 real (web UI; token can't).
2. **Add one hook** (SessionStart or PreToolUse) that runs the doctor → turns
   G1/G2 into `✅` per-run. This repo has no hooks; that's the missing rail.
3. **Realise branching** (G12) — done in principle now that `main` is canonical.

## In the harness, or around it? (classifying this very work)

A live test of the boundary, using the artifacts on this page:

| Artifact | In `harness/`? | Why |
|---|:--:|---|
| `governance/readiness.md`, `governance/environment.json` | **No — around it** | They are *declarations / records* — they describe and govern. They don't execute, and the orchestrator doesn't run them. |
| `docs/CONTROLS-REGISTER.md` | **No — around it** | Descriptive prose. |
| a future **env-audit script** (checks reality vs `environment.json`) | **Yes — in it** | Executing code, fired on a trigger, lands an outcome → it's a `service`/`hook` component, registered + contracted, the doctor would own it. |

**The rule:** the *declaration* of a control lives in the OS around the harness
(`governance/` / `record/`); the *executing code that enforces it* lives **in**
`harness/`. `environment.json` is the registry (around); the env-audit that reads it
every run is the harness (in). Same split as `manifest.json` (declaration) vs
`doctor.mjs` (the enforcing code). So: this work is correctly **out** of the harness
today; the moment we write the script that runs it every turn, *that script* moves
**in** — registered, contracted, and on the doctor's books.

## Operational layer — defined, none built (all `planned`)

| Step | Component | State |
|---|---|---|
| Extract | `signal-extractor` (every message → typed signal) | planned |
| Trace | `work-item store` + four-tuple provenance | planned |
| Clarify → Monitor | `clarifier · scoper · planner · builder · executor · tester · deployer · monitor` | planned |
| Route | `router` (orchestrator) | staging — the one wired path; reconciled to the component model when contracts land |

**Sequence:** do not build the operational layer until G12 and G15 are closed and
G6–G11 have at least their first enforcement. Then the first operational build is
the **signal → work-item tracer** (see the latest decision), running inside rails
that already hold.
