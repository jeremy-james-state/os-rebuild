# OS — Operating System

**OS = the whole; the Harness = the governed core inside it.** Clean v2 consolidation.

## The boundary (the edge)

**The Harness is the `harness/` folder** — everything that executes. Everything else
is the OS *around* it. See [`docs/BOUNDARY.md`](docs/BOUNDARY.md).

| Path | In the harness? | What |
|---|---|---|
| `harness/` | **yes** | the running code — components by type (`orchestrators/ runners/ services/ hooks/ lib/`); the source of truth is `registry.json` (component rows) + `manifest.json` (the rails), merged by `doctor.mjs` the drift-check. "Frozen" (the spine) is a component property. |
| `governance/` | no | the **law** the harness enforces: `rules/` (the rules folder), `decisions/` (binding ADRs), `agents/`, `permissions.json` |
| `docs/` | no | human knowledge: charter, boundary, principles, and `docs/architecture/` (the architecture references) |
| `record/` | no | append-only **memory / evidence** (the governance ledger) |
| `state/` | no | rebuildable **projections** (gitignored) |
| *(separate repo)* [`os-archive`](https://github.com/jeremy-james-state/os-archive) | no | the inherited **past** — prior repos, expanded & searchable (`os-v1/`, `harness/`, `frame-gate-local/`). Split out to keep this repo small; pull in on demand with `add_repo`. |

## Start here

- [`docs/BOUNDARY.md`](docs/BOUNDARY.md) — the locked edge of the harness.
- [`docs/HARNESS-CHARTER.md`](docs/HARNESS-CHARTER.md) — the constitution.
- [`harness/manifest.json`](harness/manifest.json) — what the harness is, component by component.
- [`docs/GOVERNANCE-PIPELINE.md`](docs/GOVERNANCE-PIPELINE.md) — how the harness is allowed to change.
- [`docs/architecture/`](docs/architecture/) — the prior architecture references driving full adoption.

## Check it

```sh
node governance/enforcement/doctor.mjs              # is the harness in drift? (fail-closed)
node governance/enforcement/doctor.mjs --inventory  # what's in the harness, by state
node --test governance/enforcement/doctor.test.mjs  # prove the drift-check works
```

## How it grows

Components are promoted from `os-v1/` (in the [`os-archive`](https://github.com/jeremy-james-state/os-archive) repo) into the harness one at a time,
through the governance pipeline. Until promoted, they're listed in the manifest as
`planned`, so the full inventory is visible before the code moves in.
