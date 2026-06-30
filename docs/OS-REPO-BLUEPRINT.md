# OS Repo Blueprint — Phase 0 (repo identity)

> The plan for consolidating onto one clean repo. **Nothing here is executed
> without explicit authorization.** No repo is created and nothing is pushed
> until you say so — the new repo is yours to create.

> **Superseded on harness layout (2026-06-30):** this doc describes a
> `harness/core/` + `harness/sandbox/` split (organize by *maturity*). That is
> **no longer the model** — `harness/` is now organized **by type**
> (`orchestrators/ runners/ services/ hooks/ lib/`) and promotion `state` is a
> field in `manifest.json`, not a folder. See
> [`governance/decisions/component-model.md`](../governance/decisions/component-model.md)
> and [`governance/decisions/repo-structure.md`](../governance/decisions/repo-structure.md).
> The `core/`/`sandbox/` references below are historical.

**Decisions locked (2026-06-30):**
- Naming: **OS = the whole; Harness = the governed core inside it.**
- Repo: **one brand-new clean repo named `OS`** (the old repo is now `OS-v1-retired`, freeing the name).
- Sandbox is **part of the harness**: `harness/core/` (production) + `harness/sandbox/` (workshop), one umbrella, boundary enforced by the manifest + doctor.
- Legacy: three repos frozen as **read-only snapshots** under `reference/`.

---

## 1. Identity

- The repo is **OS** (the operating system — the umbrella).
- The governed deterministic engine inside it is the **harness**.
- The harness includes its own workshop: `core/` is the trusted, load-bearing part;
  `sandbox/` is where components are drafted and tested before promotion.
- One repo, one source of truth, one tree the manifest + doctor govern.

## 2. Target skeleton

```
OS/                         ← the new repo (umbrella = operating system)
  harness/                  ← the whole harness (governed)
    manifest.json doctor.mjs render.mjs CHANGELOG.md README.md   (governance — governs both tiers)
    core/                   ← PRODUCTION: promoted, tested, load-bearing
      clarifier/ scoper/ planner/ builder/ executor/ verifier/ tester/ build-templates/
      overseer/ local-tracker/ context-window/ hooks/
    sandbox/                ← STAGING + EXPERIMENTAL harness components (the workshop)
      provisioner/ deployer/ nightly/ auto-mode/      (staging — not yet promoted)
      researcher/ explainer/ spike/                   (experimental)
  method/                   ← operating method (reasoning, not runtime)
    principles.md decisions/ specs/ definitions/ requirements/
    learnings/ reflections/ reviews/ foundation/ templates/ incidents/
  reference/                ← read-only, frozen, traceability only
    archive-os-v1/          ← full snapshot of the retired OS repo (everything)
    archive-harness/        ← full snapshot of the original harness repo
    archive-frame-gate-local/ ← full snapshot of frame-gate-local
  CLAUDE.md AGENTS.md       ← host-adapter glue (Claude Code reads CLAUDE.md at root)
  HARNESS-CHARTER.md  STATUS.md  README.md
  .claude/ .github/ .githooks/ .gitignore
```

The boundary that matters (trust) is enforced two ways: the `core/` vs `sandbox/`
split is visible at a glance, and `governance/enforcement/doctor.mjs` fails closed if any
`core/` component depends on a `sandbox/` one.

## 3. How it gets populated — three layers, in order

1. **Archive first (lossless).** Drop full, frozen, read-only snapshots of the
   retired OS, the original harness, and frame-gate-local into `reference/`. Now
   *everything* is preserved and recoverable.
2. **Promote forward (selective).** Move only the live pieces into
   `harness/core/`, `harness/sandbox/`, and `method/`. Anything not brought
   forward stays safe in the archive — it just doesn't clutter the clean tree.
3. **Govern.** Update the manifest `path` fields to the new locations, run
   `node governance/enforcement/doctor.mjs` until **0 drift**, run the tests. The manifest is the
   migration's checklist; the doctor proves the move is complete and correct.

## 4. Mapping — current OS → clean OS

| Current (this repo) | Destination | Note |
|---|---|---|
| `clarifier/ scoper/ planner/ builder/ executor/ verifier/ tester/ build-templates/` | `harness/core/…` | production engine |
| `overseer/ local-tracker/ context-window/ hooks/` | `harness/core/…` | governance, runtime/store, host adapters |
| `provisioner/ deployer/ nightly/ auto-mode/` | `harness/sandbox/…` | staging — promote to `core/` when trusted |
| `researcher/ explainer/ spike/` | `harness/sandbox/…` | experimental harness components |
| `harness/` (manifest, doctor, charter tooling) | `harness/` (root) | already built — governs both tiers |
| `scripts/ startup resume os-live cw.mjs …` | `harness/core/scripts/` (+ root shortcuts) | operational tooling |
| `handoffs/` (handoff.mjs, OWNERSHIP.md) | `harness/core/handoffs/` | continuity machinery |
| `principles.md rules-actionable.md operating-system-handbook.md techniques-library.md` | `method/` | operating method |
| `specs/ decisions/ definitions/ requirements/ learnings/ reflections/ reviews/ foundation/ templates/ incidents/` | `method/…` | reasoning + records |
| `CLAUDE.md AGENTS.md HARNESS-CHARTER.md STATUS.md` | root | umbrella docs + host glue |
| `HARNESS.md` | `harness/` | becomes a generated boundary map |
| `.claude/ .github/ .githooks/ .gitignore` | root | config (tracked settings added in Phase 2) |

## 5. What does NOT come forward (stays in `reference/archive-os-v1`, recoverable)

The sprawl and the heavy eval/UI corpora, by design: `refinement/`,
`clarifier-eval/`, `interface-build/`, the ~37 root `handoff-*.md` packets,
`session-*-output/`, `session-*.log`, `shot-*.png`, root `_*.mjs` inspection
scripts, `_states/`, `_rubric-out.json`, one-off reports, `load-backlog.sql`,
`run-ui-build.sh`. None are deleted — all are frozen in the archive snapshot.

## 6. Migration sequence (who does what)

| # | Step | Who |
|---|---|---|
| 1 | Create the empty new `OS` repo + authorize me to push to it | **you** |
| 2 | Scaffold the skeleton locally; bring governance in | me |
| 3 | Snapshot the three legacy repos → `reference/…` (read-only) | me |
| 4 | Promote-forward live pieces into `harness/core` `harness/sandbox` `method/`; update manifest paths | me |
| 5 | `doctor` until 0 drift; run all tests | me |
| 6 | Review the clean tree | **you** |
| 7 | First authorized push to the new repo | me, on your go |
| 8 | Configure branch protection on the new repo (Phase 1/2) | you + me |

**Guarantee:** steps 2–5 happen locally. No push, no PR, no repo creation until
your step 1 and step 7 authorizations.

## 7. Inputs I still need from you before execution

1. **The original harness repo location/URL** — so it can be snapshotted into `reference/archive-harness/`.
2. **The `frame-gate-local` repo location/URL** — so it can be snapshotted into `reference/archive-frame-gate-local/`.
3. (Resolved: repo name = `OS`.)

## 8. After Phase 0

- **Phase 1** — wire `governance/enforcement/doctor.mjs` into pre-push.
- **Phase 2** — pin the environment (tracked `settings.json`, `.mcp.json`, skills/plugins) + GitHub branch protection.
- **Phase 3** — restore `monitor` + `deploy` contracts; end-to-end tracing.
- **Phase 4** — gated self-rebuild (the sandbox drafts, you approve promotion to core).
