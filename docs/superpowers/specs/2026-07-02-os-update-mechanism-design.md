# OS update mechanism — immutable current, staged ship, explicit apply

> **Status:** DESIGN, approved-for-build pattern (RED-first evals before code, per
> [workbench.md](../../governance/procedures/workbench.md)). 2026-07-02.
> Builds on: sealed releases ([release.md](../../governance/procedures/release.md)),
> channels ([testflight.md](../../governance/procedures/testflight.md)), `os-publish`.

## The four invariants

**U1 — The running OS version cannot be changed.**
The release dir `current` points at is immutable — not by convention, structurally:
1. At seal time, `SNAPSHOT.json` gains an **integrity manifest**: per-file SHA-256 for
   every file in `FILES.txt`.
2. `--boot-check` (SessionStart, every session) **re-verifies the hashes** of the booted
   image — any mutation → loud fail-closed refusal + an incident row. Tampering cannot
   survive a session boundary unnoticed.
3. `os-publish --force` (reseal) is **refused once the release's `harness-v<v>` tag
   exists** — after commit+tag, a version is history, period. (Today --force is
   convention-bounded to the uncommitted window; this makes it structural.)
4. Snapshots stay git-tracked — mutation is also a visible diff CI would see.

**U2 — Ship ≠ apply.** An update can be fully built, sealed, verified and *ready* without
touching what sessions boot: `os-publish --stage` seals `<v>` (full cut-then-verify) but
does **not** repoint `current`. "An update is available" is a derived fact — newest sealed
release > current — never a mutable flag.

**U3 — Updating is an explicit, recorded, forward-only act.** A new CLI `os-update.mjs`:
- `--check` → verifies the newest sealed release's integrity and reports
  `current 1.1 · available 1.2` (exit 0 = up-to-date, exit 3 = update available). The
  SessionStart banner appends `🆙 update available: 1.2` when true.
- `--apply` → preconditions, all fail-closed: target = newest sealed; **target > current
  (downgrades refused — rollback is a different, deliberate verb)**; full
  `verifySnapshot` incl. hash manifest; publish-lock held. Then: atomic repoint →
  `--boot-check` against the new current → **a row in the `releases` stream**
  (loop-store already has it) recording from→to, who, when, verification result. The
  next session boots the new version; the running one is announced stale in the banner.
- `--rollback <v>` → the only way down: explicit version, same verification, reason
  required, recorded in the same stream (+ the R1 git-revert path remains).

**U4 — The update surface is governed like everything else.** `os: update` becomes a
census-planned `updater` app (deterministic handler wrapping os-update) so the loop can
own it; until admitted, the CLI + this procedure are the surface.

## What changes where

| Piece | Change |
|---|---|
| `os-publish.mjs` | `--stage` flag (seal, verify, no repoint) · hash manifest in SNAPSHOT.json · `--force` refused when the tag exists · boot-check verifies hashes + prints 🆙 line |
| `os-update.mjs` (new, `.system/bin/`) | `--check` / `--apply` / `--rollback <v>` as above; census row (candidate) |
| `reshape-rig` battery | the U-evals below (RED-first, before the code) |
| `release.md` / `github.md` | step 6 splits into "stage" and "apply"; update trigger documented |
| SessionStart | unchanged wiring — banner content grows |

## The evals (written RED-first, then the code makes them green)

- **U1a** mutate one file inside current's image → `--boot-check` exits non-zero naming
  the file; an incident row exists.
- **U1b** `--force` reseal of a tagged release → explicit refusal.
- **U2a** `--stage` a new version → `current` unchanged, `--check` exits 3 and names it.
- **U3a** `--apply` → current repoints atomically; boot-check green on the new version;
  a `releases` stream row records from→to; re-running `--apply` is a no-op (idempotent).
- **U3b** `--apply` when newest ≤ current → refusal (monotonic).
- **U3c** `--apply` on a staged release with a corrupted file → refusal, current untouched.
- **U4a** two concurrent `--apply` → serialized by the publish lock, one wins, pointer intact.

## Execution steps (one release, ~1.2)

1. Branch `work/os-update`; add the seven U-evals to the rig → run → all RED (recorded).
2. Implement in os-publish (hash manifest + --stage + force-guard + banner) — U1a/U1b/U2a green.
3. Implement os-update.mjs + census row — U3a/b/c + U4a green.
4. Update the two procedures; bump os-publish + os-update + reshape-rig; cut + stage the
   release; **apply it via the new mechanism itself** (the first os-update --apply is its
   own acceptance test); full battery; commit+tag same commit; PR; auto-merge on green.

## Explicitly out of scope

Auto-update (applying without an explicit trigger) — the human or the session *chooses*
to update; remote update distribution (git pull IS the distribution channel); multi-machine
fleet coordination.
