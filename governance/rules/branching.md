# Rule: Branching (Model A — GitHub standard)

**Statement.** `main` is the protected source of truth. **No direct pushes.** Every
change reaches `main` through a **short-lived `work/<id>` branch → pull request →
required `doctor` check → merge → automatic deletion.** The gate is a server-side
required status check: non-bypassable, logged, and applied to every actor.

## The unit: a branch owns a work-item (1:1)

A `work/<id>` branch is the change-vehicle for **one deliverable work-item and its
whole subtree**, from creation to merge.

| Relationship | Cardinality |
|---|---|
| work-item : branch | 1 : 1 |
| work-item : PR | 1 : 1 |
| work-item : run | 1 : many (each run stamps `session·run·call·branch`) |
| signal : work-item | many : 1 |

- Children/steps run **in the same branch** and merge as **one PR** — decomposition does not fragment branches.
- A new branch only for genuinely **separate, independently-shippable** work.
- Path authority is the write-fence + CODEOWNERS (`governance/decisions/write-zones.md`), **not** the branch.

## Branch deletion rules

A branch is **temporary by definition.** The only long-lived branch is `main`.

| Branch state | Action | Trigger / enforcement |
|---|---|---|
| **Merged** (its PR merged) | **Deleted immediately, automatically** | repo setting *"Automatically delete head branches"* — fires on every merge (platform) |
| **PR closed without merge** (abandoned) | **Deleted** | by the author at close; audited |
| **No open PR + no activity** (straggler) | **Deleted** | periodic repo-hygiene audit (Overseer) |
| **`main`** | **Never deleted** | protected (default branch) |

Governability of the deletion rule:

- **Bound** — a branch is deletable iff `merged ∨ pr-closed ∨ straggler-no-PR`; `main` never.
- **Triggerable** — on merge (auto) · on the hygiene audit (periodic).
- **Observable** — the branches page is the audit surface; each merge+delete is in the PR record.
- **Clear Exit** — the ref is removed (or, for `main`, refused).
- **Tested** — the **first merged PR must show its branch auto-deleted** — verify, don't assume.

**No merged branch ever lingers.** That — not "forbid branches" — is how sprawl is
controlled. The v1 failure was *un-deleted* branches, never the existence of branches.

## Lifecycle

`create work/<id> → runs → push → open PR → doctor (CI) must pass → merge → branch auto-deleted`

## Enforcement (set on `main`, bypass list empty)

GitHub ruleset on the **default branch**:
- **Require a pull request** — required approvals **0** for now (the `doctor` check is
  the gate; raise to 1 / CODEOWNERS when a human approval gate is wanted).
- **Require status checks to pass** → **`doctor`** (strict / branch up-to-date).
- **Block force pushes.**
- **Not** restrict-creations, **not** restrict-deletions — branches must be creatable and deletable.

Repo setting: **Automatically delete head branches = ON** — the merged-branch deletion rail.

This is the model GitHub is built for: the gate is the required check, it cannot be
bypassed, and the PR + checks + merge are all in the record.

## History (lesson kept)

A bootstrap *"single `main`, no new branches"* model was tried and reversed. Two
findings, both surfaced by testing, are preserved:
1. **A control that exempts the identity the agent uses is not a control** — an admin
   bypass exempted the session, which authenticates as the repo admin.
2. **A server required-check cannot gate a *direct* push** (only a PR), and a local
   pre-push hook is not standard governance (bypassable, unlogged).
Hence Model A. See ledger `gov-2026-06-30-013..016`.

## Status

- **Declared:** this rule.
- **Enforced (2026-06-30):** the `main` ruleset is **active** — require a pull request
  (approvals **0**) + required **`doctor`** status check (strict / branch up-to-date)
  + **block force pushes**, with repo setting **auto-delete head branches ON**. The
  **bypass list is empty**: no actor — *including the admin identity the agent
  authenticates as* — can bypass (the load-bearing condition, per `gov-2026-06-30-013..016`:
  a control that exempts the agent's identity is not a control).
- **Proof:** this rule's own enforcement PR is the **first PR** — `doctor` gates its
  merge and the head branch auto-deletes; that observed behaviour is the evidence,
  not the assertion.

**Owner:** governance / `ov`. **Basis:** decided 2026-06-30; ruleset activated
2026-06-30 (`record/governance-ledger.jsonl`, `gov-2026-06-30-024`).
