# harness/ — the governed boundary of the harness

This directory is the **governance home** of the harness: the single source of
truth for what the harness is, plus the tools that keep reality matching it.

It does **not** (yet) contain the engine code. Phase 0 declares the boundary in
the manifest and leaves engine code in place; physical relocation of production
components under `harness/` is a later, gated step.

## Files

| File | Role |
|---|---|
| `manifest.json` | **Source of truth.** Every component, its state, the sequence, the environment, governance. Editing this is editing the harness. |
| `manifest.schema.json` | JSON Schema for the manifest (editor tooling + future CI). |
| `manifest.md` | Human-readable twin, **generated** from `manifest.json`. Never edit by hand. |
| `render.mjs` | Generates `manifest.md` from `manifest.json`. |
| `doctor.mjs` | Drift-check. Validates the manifest against disk, wiring, environment, sequence. Fail-closed. |
| `doctor.test.mjs` | Tests proving the drift-check catches drift. |
| `CHANGELOG.md` | Harness version history (`harnessVersion`, semver). |

The constitution that explains all of this in prose:
[`../HARNESS-CHARTER.md`](../HARNESS-CHARTER.md).

## Commands

```sh
node governance/enforcement/doctor.mjs              # check for drift (exit 1 = drift)
node governance/enforcement/doctor.mjs --inventory  # list components by state
node governance/enforcement/doctor.mjs --json       # machine-readable findings
node harness/render.mjs --write      # regenerate manifest.md
node --test governance/enforcement/doctor.test.mjs  # run the tests
```

## Promotion states

`production` · `staging` · `sandbox` · `quarantined` · `retired`

Production never depends on `sandbox`/`quarantined`. A component reaches
`production` only via the promotion contract (frame → scope → plan → test →
human approval), never by editing the manifest alone. See the charter, §3–4.
