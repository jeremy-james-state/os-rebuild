# handoff — what it does

**Writes the session's handoff notes so the next session can pick up exactly where this
one stopped.** Run via `/handoff`. It generates the seven-section summary (current state,
mission, working model, what's on main, in flight, next steps, gotchas), saves the dated
copy under `record/handoffs/handoff-<date>.md`, and overwrites `docs/RESUME-HERE.md` —
the first file a fresh session reads. Deterministic app (no LLM inside): it guarantees
location, structure, and the completeness gate; the words come from the session.

Status: candidate (`apps/_drafts/`), not admitted. Tests: `handoff.test.mjs`.
