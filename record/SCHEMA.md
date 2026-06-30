# record/ — row schemas (the durable shape)

The data in `record/` is append-only (supersede via `supersedes_id`, never edit/delete).
Most streams are **gitignored** — their durable home is the Data Layer — so this file keeps
their *shape* in version control. The **governance ledger stays tracked** (audit trail).

Every row carries the four-tuple provenance where applicable:
`session_id · run_id · call_seq · branch`.

## `governance-ledger.jsonl` — tracked, CI-validated
One row per governance change (propose/decide/apply). Required keys (enforced by
`governance/enforcement/governance-check.mjs`): **`id`, `ts`, `change`, `scope`, `basis`,
`decidedBy`, `decision`** (+ `harnessVersion` by convention).

```json
{ "id": "gov-2026-06-30-001", "ts": "2026-06-30",
  "change": "Add rule: doc-discipline …", "scope": "governance/rules",
  "basis": "conversation 2026-06-30; approved by decision",
  "decidedBy": "jeremy", "decision": "approved", "harnessVersion": "0.3.0" }
```

## `runs.jsonl` — gitignored → Data Layer
One row per run at dispatch; the closed-loop record (every signal reaches a terminal
outcome: `completed | unknown | failed`).

```json
{ "ts": "…Z", "session": "cli", "run": "<uuid>", "call": 0, "branch": "<branch>",
  "key": "check:drift", "status": "completed",
  "outcome": { "status": "completed", "result": {…}, "signal": { "type": "check", "intent": "drift" } } }
```

## Future streams (gitignored → Data Layer)
`signals` (extractor output), `observations` (reconciler).
Add their schema here as they're introduced.

> **Interim human form (tracked markdown, not jsonl).** `incidents` and `handoffs` are filed **by
> hand as tracked markdown** today — `record/incidents/*.md` and `record/handoffs/*.md` — because
> the Data Layer that would host their gitignored jsonl streams isn't formed yet. The jsonl shape
> here is the automated form for later; the markdown folders are the curated form for now.
