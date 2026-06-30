# procedures/ — verified playbooks (the gate half)

A **procedure** is a governance gate / playbook (renamed from "skill"): a verified
recipe for an action the harness performs (e.g. "deploy a Postgres DB", "ship to
Vercel"). It is **split by part** so policy never sits inside the executing code:

| Part | Lives in | What |
|---|---|---|
| **playbook / gate** | `governance/procedures/` (here) | preconditions, steps, the gate that must pass, expected outputs — policy data, not code |
| **runnable step** | `harness/` as a `command` component | the actual executable (with a co-located `contract.json`) |
| **evidence** | `record/` → the Data Layer | the run's four-tuple + test/score that proved it worked |

On a successful run + evidence, a one-off action is **promoted** into a procedure so
next time the system looks it up and re-runs the command, with proof it was verified
before. See `docs/VOCABULARY.md` (`procedure`) and the lifecycle reference.

> Convention only — no procedures are defined yet. This README pins where each part
> goes so the first real procedure lands in the right shape.
