# harness/ — map (pointer-only)

The running code. **Folders are types; promotion state is a manifest field, not a
folder.** This map is a pointer — the system of record is
[`manifest.json`](manifest.json) (validated by `governance/enforcement/doctor.mjs`).

## Type folders
| Folder | Type | Fires | What |
|---|---|---|---|
| [`orchestrators/`](orchestrators/) | orchestrator | loop | schedules + dispatches (router, builder, pipeline, auto-mode, overseer) |
| [`runners/`](runners/) | runner | once / request | one-shot executors + agents (clarifier, scoper, planner, executor, tester, gates) |
| [`services/`](services/) | service | event / request | always-up (local-tracker server, store, context-window monitor) |
| [`hooks/`](hooks/) | hook | lifecycle event | session-start, capture, away-gate, pre-push |
| [`lib/`](lib/) | library | (imported) | pure plumbing (tagger, clarify-gate, route, build-templates, verifier) |

## Conventions
- Each real component = a directory: `index.mjs` (or platform entry) + co-located
  `contract.json` + `overview.md`. `planned` components are manifest rows until promoted.
- `state` ∈ `production | staging | sandbox | planned | quarantined | retired` — lives
  in `manifest.json`. Production never depends on sandbox/quarantined/planned (doctor-enforced).
- The enforcement spine (doctor, governance-check, structure-check) lives in
  `governance/enforcement/`, not here — by settled decision.
- Versioning: `harnessVersion` (semver) + [`CHANGELOG.md`](CHANGELOG.md).
