# Design: Write-Zones — who writes where

> Authority over paths: which agent/role may write which part of the repo.
> **Declared now** (this doc + `governance/permissions.json`); **enforced** by the
> write-fence (Stage 2, runtime) and CODEOWNERS + branch protection (merge-time,
> active). Vocabulary: `docs/VOCABULARY.md`.

## Principle — it's path authority, not branches

"Right agent writes to the right part" is **authority over paths**, not branch
isolation. Enforced in three layers, none of them long-lived branches:

1. **Contract `writes:`** — each agent declares its zone (the source of authority).
2. **Write-fence (runtime, hard)** — blocks any write outside an agent's declared
   zone. A doc-maintainer literally cannot write `harness/`.
3. **CODEOWNERS + branch protection (merge-time)** — the zone's owner reviews
   changes to it. (Active now for `harness/` + `governance/`.)

Plus the **sole-writer rule**: one store owns one table (the only writer).

## The zone map

| Path | Owner role | Writer agent(s) | Notes |
|---|---|---|---|
| `harness/` | builder | builder | the executing code |
| `harness/**/contract.json` | architect | architect / designer | a component's declared shape |
| `governance/decisions/` | architect | architect / designer | design & blueprints |
| `governance/rules/` | governance (`ov`) | learning / `ov` | promoted rules/principles |
| `governance/permissions.json` | governance (`ov`) | `ov` | the authority map itself |
| `docs/` | doc-maintainer | doc-maintainer / explainer | human knowledge |
| `docs/definitions/` | doc-maintainer | curation / researcher | the wiki |
| `record/` | stores | each store, its own table (sole-writer) | append-only memory |
| `state/` | machine | reducers only (gitignored) | rebuildable projections |
| *(separate repo)* `os-archive` | frozen | none | read-only past — `jeremy-james-state/os-archive`, no longer a folder here |

## Why not per-zone branches

A branch doesn't restrict *which paths* you can write, so a "zone branch" wouldn't
stop the wrong agent editing the wrong folder. And long-lived per-zone branches
diverge and fight at merge → merge-hell → the loss of control we escaped. So:

- **Branches stay per-*run*** (transient): one branch per task/run.
- **The write-fence enforces zones** regardless of branch.
- **Disjoint zones → runs go parallel** (each on its own run branch); **overlapping
  zones → serialise** (one writer per path).

## Status

- **Declared:** this doc + `governance/permissions.json`.
- **Enforced now:** CODEOWNERS (`harness/`, `governance/`) + branch protection at merge.
- **Enforced in Stage 2:** the write-fence reads each component's contract `writes:`
  and blocks out-of-zone writes at runtime. CODEOWNERS extended to mirror every zone.
