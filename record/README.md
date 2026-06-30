# record/ — append-only memory & evidence

**Not the harness** — it's the harness's output/memory. Append-only: supersede via
`supersedes_id`, never edit or delete. Rows carry the four-tuple
(`session_id · run_id · call_seq · branch`).

> **Split: ledger tracked, runtime streams gitignored.**
> - `governance-ledger.jsonl` — **version-controlled** (small, decision-level audit trail,
>   validated by `governance-check` at the merge gate).
> - runtime streams (`runs.jsonl`, future `signals`/`observations`/`handoffs`) — **gitignored**;
>   their durable home is the **Data Layer**. Treat them as local/runtime projections, safe to rebuild.
>
> Row shapes are documented in [`SCHEMA.md`](SCHEMA.md) so the *structure* stays in git even
> when the *data* doesn't.

- `governance-ledger.jsonl` — every governance change (propose/decide/apply), the audit trail.
- `incidents/` — the incident log, **tracked markdown** (interim human form of the `incidents` stream — see [`incidents/README.md`](incidents/README.md)).
- `handoffs/` — the session-handoff log, **tracked markdown** written by `/handoff` (interim human form of the `handoffs` stream — see [`handoffs/README.md`](handoffs/README.md)). The latest renders to `docs/RESUME-HERE.md`. (The gitignored `handoffs.jsonl` is the automated form for later.)
- (later) run records, evidence.
