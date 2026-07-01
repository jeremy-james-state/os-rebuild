# OS Index — the front door

The maintained map of the whole operating system (the folder that *is* the OS). Unlike the
**generated** harness index ([`harness/index.md`](../harness/index.md), rebuilt from
`harness/registry.json`), this file is **hand-maintained** prose — the human entry point to the
four tiers and where each thing lives. `structure-check` warns if it goes missing.

## The four tiers (see [`docs/BOUNDARY.md`](BOUNDARY.md), locked)

| Tier | Where | What it holds |
|---|---|---|
| **method** | [`docs/`](.) | How we work — charter, principles, definitions, design specs, this index |
| **governance** | [`governance/`](../governance) | The law + its enforcement (`enforcement/`: doctor, governance-check, structure-check, no-ghost-agent), decisions, rules, permissions, `architecture.json`, `candidates.md` |
| **harness** | [`harness/`](../harness) | The executing code, by type (`orchestrators/ runners/ services/ hooks/ lib/`) + the sandbox candidates (`sandbox/`); rails in `manifest.json`, rows in `registry.json` |
| **data** | `record/` + `state/` | Append-only evidence (the governance ledger is tracked) + rebuildable projections |

## Version spaces (three, nested)

- **Component** — contract-keyed semver, in each `registry.json` row (`version` + `versions[]`).
- **Harness release** — `harnessVersion` (`generation.release`), pins the component set in
  [`harness/releases/`](../harness/releases); the git tag is the capture.
- **OS architecture** — [`governance/architecture.json`](../governance/architecture.json), the
  outermost/rarest; bumped only on a tier / boundary / data-schema-shape change.

## Start here

- **What is the harness / where does it end?** → [`docs/BOUNDARY.md`](BOUNDARY.md)
- **How do the local folder and GitHub stay in sync?** → [`docs/MAINTAINING-OS-AND-HARNESS.md`](MAINTAINING-OS-AND-HARNESS.md)
- **What components exist right now?** → [`harness/index.md`](../harness/index.md) (generated)
- **What is a component?** → [`governance/decisions/component-model.md`](../governance/decisions/component-model.md)
- **What's a candidate vs admitted?** → [`governance/candidates.md`](../governance/candidates.md) · [`governance/rules/harness-admission.md`](../governance/rules/harness-admission.md)
- **The signal loop** → [`harness/sandbox/LOOP.md`](../harness/sandbox/LOOP.md)
- **Data shapes** → `record/SCHEMA.md`
