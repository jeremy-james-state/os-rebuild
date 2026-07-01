# Procedure: managing the workbench

> The workbench is the whole working tree — what you EDIT. The OS is what you BOOT
> (`.system/releases/current`). Nothing edited is live until sealed (see
> [release.md](release.md)). Which files ship: [docs/OS-CONTENTS.md](../../docs/OS-CONTENTS.md).

## Component lifecycle

1. **Draft an app**: create `apps/_drafts/<name>/` — entry `.mjs`, `contract.json`,
   **a plain-language `README.md` (required: the first paragraph must tell a non-engineer
   what it does and when it runs)**, tests, and a census row in `harness/manifest.json`
   (`state: candidate`) + a line in `governance/candidates.md`. Kernel parts live at
   `harness/loop|guard/<name>/` with `state: candidate` (location ≠ admission).
2. **Take it to Green**: its tests pass; the four checks stay clean with it present.
3. **Admission is the human's** (`governance/rules/harness-admission.md`): the census state
   flip (+ move out of `_drafts/` for apps), under CODEOWNERS review, ledger-recorded.
   A session never self-admits; the doctor fails `_drafts/` rows claiming admitted states.
4. **Withdraw**: move to `.system/trash/<name>/` with a metadata note (what/when/why/origin)
   — restorable, purgeable. **Retire deliberately**: `.system/archive/`. Never touch `record/`.

## Keeping the workbench healthy

- **The four checks** (`governance/checks/`): doctor (census ↔ disk ↔ versions ↔ pins ↔
  generated docs), governance-check (ledger, links, write-zones, architecture),
  structure-check (canonical top level, fail-closed), no-ghost-agent (every routing target
  is real). Run any time; CI runs all on every PR.
- **The battery** (`apps/_drafts/reshape-rig/`): the §D2 evals as tests + the golden master
  (`capture.mjs --check`) + the grep-gate (stale-path guard). Extend the battery rather than
  inventing parallel checks; update `coverage.json` when adding evals (M2 enforces it).
- **Write discipline (live)**: confinement blocks writes outside the repo (fail-closed);
  harness-lock serializes writers per component (spine files lock as `harness-spine`).
- **The data layer is append-only**: new streams/rows only; `record/` is never rewritten;
  the governance ledger takes additive entries only.
