# Procedure: GitHub — settings, push flow, and how it binds to version control

> The standardised path every change takes to reach `main`, the repo settings that enforce
> it, and how the platform layer locks into the OS's own version control. GitHub is the
> **platform tier** of governance (Principles → Laws/checks → GitHub), the one layer the
> session cannot edit its way around.

## Repo settings (as configured — verified live 2026-07-02)

| Setting | Value | Verified by |
|---|---|---|
| Ruleset `main-branch-governance` on `main` | `pull_request` required · `required_status_checks` = **`checks`** (the CI job) · `deletion` blocked · `non_fast_forward` blocked | `gh api repos/jeremy-james-state/os-rebuild/rulesets` + a live direct-push attempt → `! [remote rejected] (push declined due to repository rule violations)` |
| Required check `checks` | `.github/workflows/ci.yml` — the four governance checks + the FULL test battery (244 tests, serial), on every PR and push to `main`; `fetch-depth: 0` so release tags are present (the version-bump mandate needs them) | rig **G8** asserts ci.yml exists, the find-glob is intact, and discovered test files ≥ the committed baseline |
| CODEOWNERS | everything → owner; explicit lines for `harness/`, `apps/`, `.system/`, `governance/`, the spine manifest, releases, checks | rig **G7** asserts every CODEOWNERS pattern matches a real path (a move can't silently orphan the failsafe) |
| Merge style | **squash + auto-merge** — armed at PR creation, fires only when `checks` is green; no human review step (the system governs — checks + observability + auto-merge) | PRs #16–#18 all merged exactly this way |

## The standard push flow (every change, no exceptions)

1. **Branch** from fresh `origin/main`: `work/<topic>` (never commit on `main` — the
   branch-discipline guard and the ruleset both refuse).
2. **Work under the controls**: confinement + harness-lock run live; the version-bump
   mandate fires as you edit components.
3. **Gate locally**: four checks + full battery + grep-gate; if components changed —
   bump → re-cut pins → re-render → **reseal** ([release.md](release.md)).
4. **Commit with the tag in the same commit** when a release was cut (`harness-v<v>` —
   a snapshot committed after its tag reads as drift; proven, and guarded by the doctor's
   toplevel check).
5. **Push + PR + arm auto-merge**: `gh pr create … && gh pr merge <branch> --auto --squash`.
6. **CI decides.** Green → auto-merges; red → fix-forward on the branch. Never bypass,
   never force-push over history (`non_fast_forward` blocks it anyway).
7. **Tags ride with the push**: `git push origin <branch> harness-v<v>`.

## How this binds into version control & codebase management

The three enforcement levels ([versioning.md](versioning.md)) end at GitHub — it is the
level that makes the others inescapable:

- **Component/release drift → unmergeable.** The doctor is fail-closed in CI, and CI is
  the required check: an unbumped change or pin drift cannot reach `main`.
- **The tag baseline is part of CI's correctness**: `fetch-depth: 0` exists because the
  version-bump mandate baselines against `harness-v*` tags — shallow clones would silently
  disable versioning (that footgun is documented in ci.yml itself).
- **History is append-only at the platform level too**: no deletions, no force-pushes on
  `main` — matching the record layer's append-only law.
- **Settings drift is itself checked**: G7 (CODEOWNERS reality), G8 (CI wiring intact +
  test-count floor). The ruleset/required-check binding is re-verified at each adoption
  (W5 procedure — `gh api` + a live rejected direct push, output kept in the evidence pack).

## Standing rules

- One PR per coherent change-set; the PR body says what released (if a release was cut).
- Never edit `.system/releases/<v>/` (immutable history), `record/` (append-only), or a
  tag that has been pushed.
- If CI is red on `main` (should be impossible): fix-forward via a new PR — never revert
  the required check away.
