# Migrations

A running log of structural migrations to this repo. Newest first.

---

## 2026-06-30 — `archive/` split out to its own repo + history purge

### Why
The frozen `archive/` tier had grown to ~60 MB across 2,795 files — **98% of
all tracked files** — and dominated both the working tree and git history.
Cloning and loading the repo (every Claude Code web session clones fresh) was
slow as a direct result. Nothing executable depended on `archive/`; it was pure
read-only historical reference.

### What changed
- **Working tree:** `archive/` deleted. Tracked files **2,855 → 60**; working
  tree **~60 MB → ~450 KB**.
- **History rewritten:** all archive content was purged from *every* commit —
  under its current `archive/` path, its earlier `reference/` path, and the
  original OS-v1 root layout (`clarifier-eval/`, `refinement/`, `_states/`,
  `session-*-output/`, etc.). `.git` went **~25 MB → ~430 KB**.
- **Branch:** the cleaned history became the new `main`; the old history was
  discarded. **Every commit SHA prior to 2026-06-30 changed** — any old local
  clone must be re-cloned, not pulled.

### Where the archive lives now
- Repo: **[`jeremy-james-state/os-archive`](https://github.com/jeremy-james-state/os-archive)**
  (private) — contains `os-v1/`, `harness/`, `frame-gate-local/`.
- To use it from a Claude Code session: add it with `add_repo
  jeremy-james-state/os-archive`, then clone. It is read-only reference;
  nothing in this repo depends on it.

### Frozen source repos
The original repositories the archive was built from are now archived
(read-only) on GitHub:
- `jeremy-james-state/OS-v1-retired-`
- `jeremy-james-state/harness`
- `jeremy-james-state/frame-gate-local`

### Governance updates (same change)
- `governance/decisions/repo-structure.md` — `archive/` removed from the
  canonical top-level schema; the frozen past is no longer a tier.
- `governance/permissions.json` — `frozen` list now empty.
- `governance/enforcement/structure-check.mjs` (+ test) — schema updated.
- `harness/manifest.json` / `harness/CHANGELOG.md` — bumped to **0.6.0**.
