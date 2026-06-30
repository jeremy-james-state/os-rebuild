# Incident — Auto-commit hook caused repo-wide churn (2026-06-30)

- **id:** incident-2026-06-30-auto-commit-hook-churn
- **severity:** moderate
- **status:** resolved
- **owner:** jeremy (governor) · signal-ledger candidate
- **related:** ledger gov-027 (introduced) · gov-029 (the tracked-signals divergence) · gov-031 (the fix) · PRs #24 (merged the hook to main) · #28 · #29 (the fix)

## Summary

The signal-ledger candidate's capture hook was wired to **auto-commit and auto-push** the captured
signal on every turn (gov-027). When it merged to `main` (PR #24), it became active for **every
session and branch** — so multiple concurrent sessions committed + pushed a signal on every message,
polluting branches and PRs (e.g. `signal:19`/`signal:20` landed on the already-merged #28 branch),
attempting pushes to protected `main`, and tripping Stop-hook nags. In the churn, the gov-030
CI-workflow-governance layer did not survive onto `main` and had to be re-applied (#28 → re-applied).

## The five steps

1. **Root cause** — A side-effecting git action (`git commit` + `git push`) was wired into a
   per-turn lifecycle hook (`UserPromptSubmit` → `intake.mjs` → `persist.commitAndPush`), and that
   hook was merged to `main`. Hooks on `main` run in *every* session, so a per-turn auto-push was
   silently multiplied across all concurrent sessions. The deeper cause: **git was being used as a
   data transport** (signals → CI → Supabase) because the container can't reach Supabase directly —
   a stopgap that doesn't belong in a per-turn hook, let alone a repo-wide one.
2. **Recreated** — On `main` after #24: open two sessions, send a message in each. Each turn
   produces a `signals: auto-capture …` commit + push; concurrent pushes/PRs interleave and clobber
   (observed: gov-030 dropped during the #24 squash / #26–#27 interleave; junk signal commits on a
   merged branch).
3. **Immediate fix** — PR #29: `intake.mjs` made **capture-only** (append the signal, no commit/no
   push); `persist.mjs` removed; `record/signals.jsonl` untracked + gitignored. Churn stops the
   moment the hook file is capture-only (it's read fresh each turn).
4. **Long-term solution** — Signal **transport to the Data Layer is not git's job.** It belongs to
   the Data Layer once formed (direct ingest from a real store), and **routing** belongs to the
   orchestrator/dispatcher — not to a lifecycle hook. Capture stays a quiet local append.
5. **Preventative** — (a) **Lifecycle hooks do not perform git writes** — capture is observe-only,
   fail-open. (b) `record/` runtime streams stay **gitignored** (main's PR #23 policy), so a hook
   can't accumulate committable churn. (c) Don't merge **session-automation hooks repo-wide** to
   `main` without weighing multi-session amplification. *(Still open / future: a session-coordination
   guard so concurrent merges can't silently clobber — the manifest's Law 1/9 territory, unenforced
   in cloud.)*

## Lesson

A hook that writes to git turns every turn into a commit and every session into a writer — harmless
in one branch, churn at repo scale. **Capture observes; it does not persist to git.** And using git
as a transport for runtime data was the stopgap that invited all of it — the real home is the Data
Layer. This is exactly the kind of gap the manual incident log is meant to catch early, before the
orchestrator exists to prevent it automatically.
