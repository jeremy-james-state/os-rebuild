# Rule: Handoffs

> Every session handoff MUST be saved to `record/handoffs/handoff-<YYYY-MM-DD>.md` — the
> append-only, tracked-markdown history — and rendered to `docs/RESUME-HERE.md`, the always-current
> "read this first". **Never at repo root, never anywhere else.** The `handoff` component
> (`apps/_drafts/handoff/`) is the deterministic guarantor of that location.
> Owner: `harness`. Enforcement: the component's test + the merge gate (deterministic), not a
> declaration. Normative code: [`../../apps/_drafts/handoff/handoff.mjs`](../../apps/_drafts/handoff/handoff.mjs).

## Why

A handoff that lands in the wrong place — repo root, an ad-hoc file, a gitignored jsonl — is a
handoff that is lost. v1 relied on the model *remembering* to write to the right path; that is a
declaration, and declarations drift. The guarantee has to come from **deterministic code + a test +
the gate**, exactly as `incident` guarantees `record/incidents/`.

## The guarantee (computed in code, not passed in)

- `handoffsDir()` = `join(REPO_ROOT, 'record', 'handoffs')` and `resumePath()` =
  `join(REPO_ROOT, 'docs', 'RESUME-HERE.md')` — both **derived from the repo root**, never a
  free-form argument. A caller supplies the handoff *content*; it cannot choose the *location*.
- `save(body, { date, session, gitHead })` writes exactly two files:
  1. `record/handoffs/handoff-<date>.md` — filename derived from the date; a small header
     (`id` / `session` / `git_head`) + the body. **Append-style history**: a new dated file per
     handoff, never an overwrite of a past one.
  2. `docs/RESUME-HERE.md` — the **overwrite** render of the latest handoff.
- A handoff is **complete** only when all seven sections are present — Current state · Mission ·
  Working model · What's on main · In flight · Next steps · Gotchas (`SECTIONS` +
  `missingSections`/`isComplete`). `handoff check` exits non-zero on an incomplete handoff, so an
  incomplete handoff cannot pass the gate.

## Enforced by

- `apps/_drafts/handoff/handoff.test.mjs` — proves `save()` writes under `record/handoffs/` with
  the `handoff-<date>.md` name, writes `docs/RESUME-HERE.md`, that the location is derived (not
  redirectable), and that an incomplete handoff is flagged. **If the save path ever changes, this
  test fails.**
- The merge gate runs the doctor + the full test suite; a regressed save location or a broken
  contract is rejected before merge.
- `apps/_drafts/handoff/contract.json` declares `writes: ["record/handoffs/", "docs/RESUME-HERE.md"]`
  — the write-zone declaration, validated against `harness/contract.schema.json` by the doctor.

## The hard line

- No handoff at repo root. No handoff in a one-off path. No handoff to a gitignored jsonl.
- The `/handoff` command is the *door* — it generates the body; the `handoff` component *guarantees*
  the location by saving through `save()`. The command never writes the files itself.
