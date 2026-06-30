# Decision: Phase 3 Repo Structure

## Canonical top-level schema

Every top-level folder is one tier; a new one is drift.

- `harness/` = operational system (does work): folders are **types** (`orchestrators/ runners/ services/ hooks/ lib/`) + `manifest.json` + `CHANGELOG.md` (versioned self-declaration). Promotion `state` is a manifest field, not a folder; `agent`/`command`/`query`/`store` are derived roles, not folders. **[gate: human]**
- `governance/` = the rails: the law (decisions, rules, permissions) **and** its enforcement (`governance/enforcement/`: doctor, governance-check, structure-check) **[gate: human]**
- `docs/` = descriptive (method: principles, definitions, **procedures**, templates) **[bot]**
- `record/` = append-only logs — runtime streams **gitignored** (durable home = the Data Layer); the **governance ledger stays tracked** (audit trail, CI-validated); shape in `record/SCHEMA.md` **[bot]**
- `state/` = projections — **gitignored; the Data Layer** **[bot]**
- `.github/` = gate infrastructure (CI, CODEOWNERS, Copilot config) **[human]**
- `.claude/` = Claude Code session tooling (slash commands) — NOT part of the operational harness **[human]**

## Principles

- `governance/` is the catch-all for everything that binds, so enforcement lives **inside it** (`governance/enforcement/`), not as a sibling folder.
- The harness is purely operational.
- `operational/enforcement` and `declaration/execution` are component **labels** (roles), not folders (like "frozen is a property, not a folder").
- A new top-level folder is drift; only the human declares one.
- The frozen **past** is not a tier of this repo: it lives in the separate [`jeremy-james-state/os-archive`](https://github.com/jeremy-james-state/os-archive) repo (was `archive/`), pulled in on demand via `add_repo`. This keeps the operational repo small and fast to clone.
- **Four-layer framing:** method (`docs/`) · governance (`governance/`, incl. its `enforcement/`) · operational (`harness/`) · evidence/memory (**the Data Layer**; `record/`+`state/` are gitignored repo-side mounts). Canonical glossary: [`docs/VOCABULARY.md`](../../docs/VOCABULARY.md).
- **The safety spine is a property, not a folder** (settled): the dispatcher/write-fence/gates are `frozen` components in their `harness/` type-folders; there is **no top-level `enforcement/` tier**. The verifiers live in `governance/enforcement/`.
- **Procedures split by part** (settled): the playbook/gate → `governance/procedures/`; the runnable step → a `command` in `harness/`; evidence → `record/`/Data Layer.

## Harness version control

Semver lives in `harness/manifest.json` (`harnessVersion`) and `harness/CHANGELOG.md`, bumped with any state/boundary/shape change; the repo relies on git.

## Recording convention

Every decision carries a **Status** (`settled` | `provisional (revisit)`) with basis.

## Status

- schema + governance-as-catch-all + tiers-as-labels = **settled**
- the name `harness` = **provisional (revisit)** (`system` is an alternative)
- relocation of verifiers = **done in this PR**
- relocation of the frozen `archive/` out to the `jeremy-james-state/os-archive` repo (shrinks the operational repo; frozen-past added on demand) = **settled**
- **System-architecture definitions locked 2026-06-30** (F1–F6): names OS/harness/governance kept + 4-layer overlay (F1); spine = property-not-a-folder, no top-level `enforcement/` (F2); 5 type-folders kept (F3); `blueprint` names `manifest.sequence` (F4); `record/`+`state/` gitignored → Data Layer (F5); procedures split by part (F6). The one stale doc (`docs/architecture/harness-architecture.md`) is reconciled to this. = **settled**

This supersedes the informal allowed-folder list in the doctor (`KNOWN_NON_HARNESS`).
