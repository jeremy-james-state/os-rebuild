# Handoff

Two surfaces, one purpose: a successor session resumes in ~60 seconds.

## `docs/RESUME-HERE.md` — the render (loose)

The *current* handoff, human-readable. Overwritten on every `/handoff` run; disposable; only ever the latest snapshot, never history. A convenience view, not a source of truth. Do not edit by hand. Tier: `docs/` (descriptive).

## `record/handoffs.jsonl` — the record (locked)

The append-only log of *every* handoff, structured (one JSON object per line). This is the truth and the history. Each `/handoff` appends exactly one immutable line; existing lines are **never edited or deleted**. Locked down the same way as `record/governance-ledger.jsonl`: schema-validated and append-only.

## The rule

The record is the source of truth; `RESUME-HERE.md` is a disposable render of the latest entry. If they ever disagree, **the record wins**. The lock on the record is **append-only integrity** (you may only add lines, never rewrite history) — not per-append human review — so a handoff can persist itself while history stays tamper-evident.

## Status

- Append-only + schema enforcement of `record/handoffs.jsonl` by the governance-check is **planned** (same treatment the ledger already gets), not yet wired. Until then the rule is followed by discipline.
