# Versioning — the three levels, and how each is ENFORCED

> Nothing here is convention-only. Every level has a fail-closed check and a test; the
> controls fired live, repeatedly, during the os-reshape (releases 0.14 → 1.0).

| Level | What it versions | Where it lives | Enforced by (fail-closed) | Tested by |
|---|---|---|---|---|
| **Component** (semver) | one app/kernel part | its census row (`version` + `versions[]` history) in `harness/manifest.json` | doctor `version-bump-required` — any substantive change since the last `harness-v*` tag with an unchanged version is an ERROR; `version-without-history`/`changelog-stale` catch undocumented bumps | rig **G6** (fault-injected, in CI) + `doctor.test.mjs` |
| **Harness release** (`generation.release`) | the pinned SET of all components | `.system/releases/<v>.json` (`pins`) + `harnessVersion` in the manifest + git tag `harness-v<v>` | doctor `release-missing` / `release-pin-drift` — a census version that disagrees with the active release's pin is an ERROR (adding/bumping ANY component forces a re-cut); tag⇄pin baseline integrity guarded by the toplevel check | `doctor.test.mjs` (`checkReleaseConsistency`) + fired live 6× this migration |
| **OS / boot** | the sealed image a session runs | `.system/releases/<v>/` + `current` pointer + `SNAPSHOT.json`/`FILES.txt` | `os-publish` cut-then-verify (doctor+no-ghost+boot smoke INSIDE the image, re-verified at the final location) — refuses to repoint on any failure; `--boot-check` refuses blank versions, stale pointers, channel mismatches; releases immutable | rig **S0–S8, X3** (in CI) + the SessionStart banner |
| **Architecture** (shape) | tiers/boundary/data-shape | `governance/architecture.json` (`architectureVersion`, now 2.0) | governance-check `architecture-version-mismatch` / `architecture-missing` — a version without a matching history entry (and ledger line) is an ERROR | `governance-check.test.mjs` |

**The chain that makes it bite:** CI (the required check on `main`) runs all four checks +
the full battery on every PR; direct pushes to `main` are rejected by the ruleset; merge is
auto on green only. So a version violation anywhere → doctor RED → CI RED → unmergeable.

**Live proof from this migration:** adding the rig forced 0.14 (`release-pin-drift`); every
phase's edits tripped `version-bump-required` until bumped (including the P4 evidence append
— complied with via 0.21 rather than special-cased); a snapshot committed after its tag was
caught reading as drift and is now structurally guarded (toplevel check).
