# Maintaining the OS + Harness — local ↔ GitHub

> **Method / procedure.** How the local working folder and the GitHub repo relate, and how to keep
> them consistent. Companion to [`GITHUB-AND-LOCAL.md`](GITHUB-AND-LOCAL.md) (the disciplined
> PR-gated stance) — this file documents the **local-first mechanics**, which hold under either
> write-path.

## The one fact that removes the confusion

There is **one repo, one folder.** The working folder `/Users/jeremyjames/Projects/os-rebuild` is a
git clone whose `origin` is `https://github.com/jeremy-james-state/os-rebuild`. It is **not** a second
copy kept in sync by hand — it **is** the working copy of that repo.

## Direction of flow (local-first)

```
edit files IN the folder ──► git commit (folder's .git) ──► git push origin <ref> ──► GitHub
        (source)                  (local history)               (uploads)            (mirror)
```

- Changes **originate in the folder**. `commit` records them in the folder's own `.git`; `push`
  **uploads** the committed history to GitHub.
- The folder is the **source**; GitHub is the **mirror that catches up** on each push. `push` never
  downloads into the folder.
- Nothing is edited directly on GitHub, so for work done here the folder is never *behind* GitHub.

## The procedure (per milestone)

1. **Edit** in the folder.
2. **Verify green** — the four checks + tests:
   `node governance/enforcement/{doctor,governance-check,structure-check,no-ghost-agent}.mjs` and
   `node --test $(find harness governance -name '*.test.mjs')`.
3. **Commit** a coherent milestone (version bump + `CHANGELOG.md` line where a component changed).
4. **Push** (`git push origin main`); when a release is cut, also `git push origin <tag>`.
5. Repeat. After each push, **local == GitHub**.

## Verify the folder ↔ GitHub are in sync

```sh
git -C /Users/jeremyjames/Projects/os-rebuild rev-parse main        # local main SHA
git ls-remote origin -h refs/heads/main | awk '{print $1}'          # GitHub main SHA — should match
git rev-list --left-right --count origin/main...main                # "0  0" (behind ahead) = in sync
git status -s                                                       # empty = no in-flight (uncommitted) work
```

Equal SHAs **+** `0 0` **+** clean `status` ⇒ the folder and GitHub are byte-identical.

## The only time they differ: the in-flight window

While you (or a subagent) are editing, the folder holds **uncommitted** changes that exist **only in
the folder** until they are committed + pushed. That is normal and expected — `git status -s` shows
them, and the gap closes on the next commit + push. It is the single moment the two aren't identical.

## Write-target policy (a separate choice from the mechanics)

The mechanics above are the same no matter *where* you push. What differs is the **write target**:

- **Local-first, direct to `main`** — used in active build sessions (including unattended runs):
  commit + push straight to `main`; the four checks (run locally, and in CI once activated) are the
  gate. Fast; suited to a single disciplined writer.
- **PR-gated, read-only local** — the disciplined stance in
  [`GITHUB-AND-LOCAL.md`](GITHUB-AND-LOCAL.md): push a branch → PR → review → merge; the local clone
  stays a read-only window. Suited to surrendering control safely / multiple writers.

Choose per session. **The folder↔GitHub sync mechanics do not change** — only the ref you push to.

## How the harness reinforces this

From release `harness-v0.8`, drift is **observable, not silent**: the **reconciler**
(`harness/sandbox/reconciler/` → `gitDrift`) raises an incident for **committed-but-unpushed**
commits, an **untagged release**, or a **version ↔ tag ↔ release** mismatch. So an un-synced folder
surfaces itself instead of quietly diverging — which is the whole point of the version-control layer
([design](superpowers/specs/2026-07-01-harness-version-control-design.md)).
