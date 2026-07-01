---
description: Generate a session handoff and store it in the markdown data layer (record/handoffs/)
allowed-tools: Bash(git status:*), Bash(git log:*), Bash(git rev-parse:*), Bash(node harness/sandbox/handoff/handoff.mjs:*), Read, mcp__github__list_pull_requests
---

# /handoff — Session handoff (governed by the `handoff` component)

Generate the handoff **body**, then hand it to the `handoff` component to **save**. The command is
the door; the component (`harness/sandbox/handoff/handoff.mjs`) GUARANTEES the location —
`record/handoffs/handoff-<YYYY-MM-DD>.md` (append-only history) **and** `docs/RESUME-HERE.md` (latest
render). You do not choose where it lands; the component computes both paths from the repo root. Rule:
[`governance/rules/handoffs.md`](../../governance/rules/handoffs.md).

## Steps

1. **Verify current state first** — do not write anything until you have run:
   - `git status`
   - `git log --oneline -10`
   - `git rev-parse --short HEAD` (the `git_head` for the header)
   - List open PRs (`mcp__github__list_pull_requests`)

2. **Generate the body** using the fixed seven-section structure (see
   `record/handoffs/_template.md`): Current state · Mission · Working model · What's on main ·
   In flight · Next steps · Gotchas. Keep each section short and scannable — a 60-second
   orientation. Use only facts verifiable from `git` output and open PRs; do not fabricate state.

3. **Save via the component** — do NOT write the files yourself. Call `save()` so the location is
   guaranteed. From the repo root, run a one-off node invocation that imports `save` and passes your
   generated body + `{ date, session, gitHead }` (session id if known, else `unknown`; gitHead =
   the short SHA from step 1). The component writes `record/handoffs/handoff-<date>.md` (with the
   `id`/`session`/`git_head` header) and overwrites `docs/RESUME-HERE.md`.

4. **Confirm** — report the two paths the component returned (`datedPath`, `resumePath`). Optionally
   run `node harness/sandbox/handoff/handoff.mjs check all` to confirm the handoff is complete
   (all seven sections present) — it exits non-zero if any section is missing.

## Rules

- The `handoff` component owns the save location — never write `record/handoffs/*` or
  `docs/RESUME-HERE.md` by hand, and never create files at the repo root.
- The dated `record/handoffs/*.md` files are **append-style history** — never edit or delete a past
  handoff; each `save` writes a new dated file. `docs/RESUME-HERE.md` is the **overwrite** render.
- A handoff is complete only when all seven sections are present (`handoff check` is the gate).
- Do NOT write `record/handoffs.jsonl` — it is gitignored and would not persist.
