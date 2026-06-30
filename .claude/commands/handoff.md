---
description: Generate a session handoff and store it in the markdown data layer (record/handoffs/)
allowed-tools: Bash(git status:*), Bash(git log:*), Read, Edit, Write, mcp__github__list_pull_requests
---

# /handoff — Session handoff (stored as tracked markdown)

Generate a concise, scannable session handoff and write it to TWO surfaces:
1. A **new dated file** `record/handoffs/handoff-<YYYY-MM-DD>.md` — the append-only history
   (tracked markdown, so it persists into the gated repo). Mirrors the `record/incidents/` model.
2. Overwrite `docs/RESUME-HERE.md` — the always-same-path "read this first" render of the latest.

Both carry the same body; the dated file adds a small header (id / session / git_head). No files
at repo root; no other files. The area is defined in
[`record/handoffs/README.md`](../../record/handoffs/README.md).

> **Why markdown, not `record/handoffs.jsonl`.** Runtime jsonl streams under `record/` are
> gitignored (durable home = the Data Layer), so a jsonl handoff would not persist. Until the Data
> Layer is formed we file handoffs **by hand as tracked markdown** — the same interim move as
> incidents. The machine `handoffs` stream is the automated form for later.

## Steps

1. **Verify current state first** — do not write anything until you have run:
   - `git status`
   - `git log --oneline -10`
   - List open PRs (`mcp__github__list_pull_requests`)

2. **Generate the handoff content** using the fixed seven-section structure (see
   `record/handoffs/_template.md`): Current state · Mission · Working model · What's on main ·
   In flight · Next steps · Gotchas.

3. **Write the dated history file** `record/handoffs/handoff-<YYYY-MM-DD>.md`:
   - Copy the shape of `record/handoffs/_template.md`.
   - Header: `id: handoff-<YYYY-MM-DD>`, `session:` (id if known, else `unknown`), `git_head:`
     (short SHA of HEAD).
   - If a file for today already exists, append a `-2`/`-3` suffix — never overwrite a past
     handoff (append-style history).
   - Append a one-line entry under `## Log` in `record/handoffs/README.md`.

4. **Overwrite `docs/RESUME-HERE.md`** with the same seven sections (no per-file header; keep the
   "auto-generated — do not edit by hand" banner). Always the same path; replace the whole file.

## Rules

- Keep every section short and scannable — a 60-second orientation, not a detailed report.
- Use only facts verifiable from `git` output and open PRs — do not fabricate project state.
- The dated `record/handoffs/*.md` files are **append-style** — never edit or delete a past
  handoff; write a new dated one.
- `docs/RESUME-HERE.md` is **overwrite** — always replace the whole file.
- Both surfaces use exactly those paths. The dated file is the history; `RESUME-HERE.md` is the
  latest pointer. Do NOT create any other file. Do NOT create files at the repo root.
- Do NOT write `record/handoffs.jsonl` — it is gitignored and would not persist.
