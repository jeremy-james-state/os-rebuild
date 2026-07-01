# Procedure: cutting a release

> The one path from "edited code in the workbench" to "the OS a session boots".
> Everything here is enforced by checks — skipping a step turns something red.

## When

Any substantive change to a component (the doctor's `version-bump-required` fires on
anything except `CHANGELOG.md` and `*.test.mjs` under a pinned component's path — evidence
docs included, deliberately). Batch related changes into one release.

## Steps

1. **Work on a branch** (`work/<topic>`). Direct pushes to `main` are rejected by the
   `main-branch-governance` ruleset (proven live).
2. **Bump every touched component** in `harness/manifest.json`: `version` + a `versions[]`
   entry (what changed, why). The doctor tells you exactly which ones you missed.
3. **Cut the pin**: write `.system/releases/<v>.json` — `harnessVersion`, `generation`,
   `release`, `date`, `notes`, `pins` (every component id → version). Set
   `harnessVersion: "<v>"` in the manifest. Version grammar: `generation.release`
   (generation bumps only on a rails/boundary shift — e.g. 1.0 was the os-reshape).
4. **Regenerate**: `node harness/render.mjs --write && node harness/render.mjs --index &&
   node harness/render.mjs --changelogs` (the doctor byte-compares these).
5. **Gate locally**: the four checks green + the full battery
   (`node --test --test-concurrency=1 $(find harness apps governance .system -name '*.test.mjs')`)
   + `node apps/_drafts/reshape-rig/grep-gate.mjs`.
6. **Seal**: `node .system/bin/os-publish.mjs` — assembles the snapshot, runs
   **cut-then-verify INSIDE the image** (doctor + no-ghost + hostile boot smoke), re-verifies
   at the final location, atomically repoints `current`. Releases are **immutable**
   (`--force` reseals only within an uncommitted window; never after the tag).
7. **Verify the boot**: `node .system/bin/os-publish.mjs --boot-check` →
   `🖥 OS v<v> booted · channel current · N components`.
8. **Commit + tag in the SAME commit**: `git tag harness-v<v>` on the commit that contains
   the snapshot (proven: a snapshot committed after its tag reads as drift inside the image).
9. **Push + PR**: CI (4 checks + full battery, ≥100) is the required check; **auto-merge on
   green** — no human review step; the system governs.

## Rollback

Repoint the channel at any retained release (`.system/releases/`), or `git revert` the
release commit — the R1 drill proved F1–F4 stay green after a revert.
