# rules/ — the policy the harness enforces

Promoted from learnings/decisions deliberately (never auto-accreted). Each rule is
short and carries an owner + an enforcement mechanism, or is marked `pending`.
Source material to promote from: `os-v1/` (principles.md, decisions/, rules-actionable.md) in the [`os-archive`](https://github.com/jeremy-james-state/os-archive) repo.

- [`branching.md`](branching.md) — Model A branch → PR → required check → merge → delete.
- [`doc-discipline.md`](doc-discipline.md) — classify before write; one authority, one home.
- [`harness-admission.md`](harness-admission.md) — Located · Registered · Contracted · Green · Admitted; a candidate is not the harness until a human admits it.
- [`ci-workflows.md`](ci-workflows.md) — CI workflows are governed controls; declared in `environment.json`, ledgered, owner-approved; undeclared = drift (fail-closed).
