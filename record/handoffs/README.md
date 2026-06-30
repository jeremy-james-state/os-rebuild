# record/handoffs/ — the session-handoff log (work-in-progress data layer, human form)

The durable, human-curated record of session handoffs — the 60-second orientation a future
session reads to pick up where the last one left off. Tracked markdown, one file per handoff —
the **interim** form of the data layer's `handoffs` stream while the Data Layer isn't yet formed.

> **Why markdown, why now.** Same reasoning as [`../incidents/`](../incidents/README.md): the
> machine `handoffs` stream (gitignored jsonl → Data Layer, per [`../SCHEMA.md`](../SCHEMA.md)) is
> the automated form for later; this folder is the human form for now, so handoffs actually
> **persist into the gated repo** instead of evaporating with the session. (These markdown files
> **are** tracked — they're curated records, not runtime stream data.)

## Two surfaces

1. **The history** — `handoff-YYYY-MM-DD.md`, one file per handoff, append-style (never edit a
   past handoff; write a new dated one). This folder.
2. **The latest** — [`../../docs/RESUME-HERE.md`](../../docs/RESUME-HERE.md), the always-same-path
   render of the most recent handoff. Overwritten each time. **Read this first.**

Both are written by [`/handoff`](../../.claude/commands/handoff.md). The dated file and
`RESUME-HERE.md` carry the same body; the dated file adds a small header (id / session / git_head).

## Structure (the fixed seven sections)

Current state · Mission · Working model · What's on main · In flight · Next steps · Gotchas.
Copy [`_template.md`](_template.md) to `handoff-YYYY-MM-DD.md` and fill it. Keep every section
short and scannable — orientation, not a report. Use only facts verifiable from `git` and open PRs.

## Log

- [`handoff-2026-06-30.md`](handoff-2026-06-30.md) — reinstating `/handoff` into the markdown data layer.
