# Governance Pipeline — how the harness is *allowed to change*

> The missing half of the model. The manifest defines **what** the harness is;
> the doctor checks it stays that way; this pipeline defines **how it may change** —
> with cadence, predictability, and a full audit trail. Every governance change is
> logged and auditable. Companion to `HARNESS-CHARTER.md` and `CONTROLS-REGISTER.md`.

Status: draft · 2026-06-30 · stands up in the clean `OS` repo.

---

## 1. Principle

**A governance change is "a decision with a basis" — which is your work-unit
definition.** So this is not a second engine: it is a **typed lane of the existing
chain** (`operation = Decide`), with two things added that ordinary work doesn't
require: an **always-human gate**, and a **guaranteed audit-ledger entry**.

One chain, two tracks: **work** and **governance**. They overlap by design.

## 2. What counts as a governance change (triggers)

- Add / change / remove a law or control
- Promote or demote a component (any manifest `state` change)
- Edit the manifest boundary or sequence
- Change an environment/host control (settings, hooks, GitHub scope)
- Change GitHub rules (branch protection, CODEOWNERS)
- Any `harnessVersion` bump

If a change touches the control surface, it rides this lane. If it doesn't, it's
ordinary work.

## 3. The lane — five gates

```
propose → review → decide → apply → log
```

| Gate | What happens | Artifact / check |
|---|---|---|
| **propose** | Raise the change: what, why, scope, risk, reversibility, basis | a decision record in `method/decisions/` |
| **review** | Impact + adversarial check: what does this change about the boundary? reversible? does any `core` end up depending on `sandbox`? | agent pre-check + **`doctor` dry-run** |
| **decide** | **Human gate** — approve / refine / reject. Mandatory for anything load-bearing; no auto-approval of a control | recorded decision (approver, date) |
| **apply** | Make the change; **bump `harnessVersion`**; regenerate the MD twin; **`doctor` must reach 0 drift** | manifest + CHANGELOG diff |
| **log** | Append one immutable entry to the **governance ledger** | `governance-ledger.jsonl` (+ generated MD view) |

## 4. The governance ledger (the audit trail)

Append-only `governance-ledger.jsonl`. One row per governance change, never edited:

```json
{ "id": "...", "ts": "...", "change": "promote provisioner staging->production",
  "scope": "harness/runners/provisioner", "basis": "decisions/decision-...md",
  "before": "<chain-state digest>", "after": "<chain-state digest>",
  "harnessVersion": "0.3.0", "decidedBy": "jeremy", "decision": "approved" }
```

This answers, at any time: **what changed about governance, when, why, by whom,
and who approved it** — the traceability you asked for.

## 5. Reuse map — mostly wiring, not new machinery

| Need | Existing piece |
|---|---|
| propose / decide artifacts | `method/decisions/` (decision records) |
| apply + log machinery | `approval-runner` + its SQLite/JSONL store |
| version trail | `harnessVersion` + `harness/CHANGELOG.md` |
| review + apply integrity | `governance/enforcement/doctor.mjs` (dry-run on review, 0-drift on apply) |
| pre-merge enforcement | `decision-enforcer` + GitHub branch protection |

## 6. Enforcement (where it actually bites)

A governance change **cannot merge to `master`** without: a decision record, a
recorded human approval, a passing `doctor`, a `harnessVersion` bump, and a ledger
entry. Because the repo's own hooks don't fire in cloud (see `CONTROLS-REGISTER.md`,
Layer 1), the **non-bypassable enforcement is a GitHub branch-protection status
check** on `master` — a small `governance-check` that verifies those five artifacts
are present in the PR.

## 7. Cadence & predictability

- **Routine** governance changes are reviewed on a predictable cadence (a periodic
  governance pass), not ad hoc — this is the "cadence and predictability" you want.
- **Emergency** changes (incident-driven) may fast-track `apply` but still **log
  immediately** and get **retroactive `decide`** — mirroring the existing incident
  fast-track rule (priority, never a skipped gate).

## 8. Lifecycle states (a governance unit)

`proposed → in-review → approved | refining | rejected → applied → logged`

Mirrors the work chain so the same tracker/surface shows both tracks.

## 9. How this closes the loop

Together: **manifest** (what is) + **doctor** (stays true) + **governance pipeline**
(how it changes) + **governance ledger** (history of changes) = the harness can
safely rebuild itself, because every self-change is a logged, human-approved
governance unit. This is the concrete mechanism behind "the harness builds itself,
but under control."
