# Decision: Manifest / Registry split (the system of record)

> The harness's machine-readable source of truth is **two files, merged**: `harness/registry.json`
> holds the component **rows**; `harness/manifest.json` holds the **rails**. The doctor and the
> renderer merge them into one shape, so nothing downstream changed. Normative.
> Implementation shipped in PR #27 (`harnessVersion` 0.8.0). Component shape: `component-model.md`.

## Why

`manifest.json` had grown into a monolith — the component rows blended with the rails (the shape,
chain, environment, governance). The locked `component-model.md` and the glossary (`docs/VOCABULARY.md`,
`harness/map.md`) already named a `registry.json` as the component system of record, but it didn't
exist. The split makes reality match the model and gives the rows their own file (and their own schema)
without disturbing the rails.

## What lives where

| File | Holds | Schema |
|---|---|---|
| **`harness/registry.json`** | the component **rows** (the system of record) + a meta header (`registryVersion`, `updated`) | `harness/registry.schema.json` |
| **`harness/manifest.json`** | the **rails**: `states`, `kinds`, `executionContexts`, `boundary`, `sequence` (the blueprint), `chain`, `environment`, `governance` | `harness/manifest.schema.json` |

A row's promotion `state`/`kind`/`type` reference the manifest's vocabulary — the same way
`sequence.steps` reference component ids. Each **non-planned** component also carries a co-located
`contract.json` (`input`/`output`/`reads`/`writes`/`triggers`); that requirement is **deferred while
components are `state: planned`** and attaches on promotion.

## How they're read

The doctor (`governance/enforcement/doctor.mjs`) and `harness/render.mjs` load both files and **merge**
them — `{ ...manifest, components: registry.components }` — then run every check / render the twin off
that single object. Consequence: all 8 checks, `render()`'s body, and the inline-object tests are
**unchanged**; the generated `manifest.md` is byte-identical bar the version header. A missing/garbled
registry is **fail-closed** (`registry-unreadable` ERROR), mirroring `manifest-unreadable`.

## Versioning

Three independent version fields: **`harnessVersion`** (semver — the boundary itself; MAJOR/MINOR/PATCH
per `manifest.versioning`), **`manifestVersion`** and **`registryVersion`** (each file's own
schema/format version). History: `harness/CHANGELOG.md`.

## Open — harness shape: instances & versions (PROVISIONAL, revisit)

The split surfaces a larger, **undecided** question about the harness's shape:

- **(a)** change the `harness/` folder structure to mirror the data model, **or**
- **(b)** keep the current type-folders and instead get *better at representing* **instances** of the
  harness (`executionContexts` — local/cloud, keyed by git-remote identity; there is no
  `record/instances.jsonl` yet) **and versions** (`harnessVersion` + `CHANGELOG.md`).

Current lean is **(b)**, but this is explicitly **not decided**. See `HARNESS-CHARTER.md` (§ execution
contexts) and `component-model.md`.

## Status

- the manifest/registry split = **settled / done** (PR #27, `harnessVersion` 0.8.0).
- per-component `contract.json` requirement = **planned (deferred)** — attaches when a component leaves `planned`.
- harness shape (instances-vs-folders) = **provisional (revisit)**.

Basis: conversation 2026-06-30 + PR #27. Owner: `ov`.
