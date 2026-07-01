# signal-ledger — CANDIDATE (not admitted)

> Lives in `apps/_drafts/`. It **is not the harness** — it is a candidate at step
> **Green** of [`governance/rules/harness-admission.md`](../../../governance/rules/harness-admission.md).
> Registered in [`governance/candidates.md`](../../../governance/candidates.md). Promotion
> into `harness/core/` and the harness file is a human step.

## What it does

Captures **every real input** as a four-tuple-stamped **signal** — the first piece of the data layer.

```
a run happens ─▶ intake.mjs (hook) ─▶ record/signals.jsonl   (local, append-only, GITIGNORED)
                                              │
                                       rebuildProjection()
                                              ▼
                                       state/os.db  (PROJECTION, rebuildable, gitignored)
                                              ▼
                                       view.mjs ─▶ HTML you can read
```

Every signal carries the four-tuple — `session · run · call · branch`. Per the `record/` policy,
`signals.jsonl` is a **runtime stream**: gitignored, local, **its durable home is the Data Layer**.

## Pieces

| File | Role |
|---|---|
| `contract.json` | the declared shape (input/output/reads/writes/provenance/invariants) |
| `ledger.mjs` | `appendSignal` (append-only), `signalGaps` (completeness), `rebuildProjection` |
| `filter.mjs` | drops system-injected turns so only real inputs become signals |
| `intake.mjs` | hook handler: stdin payload → one stamped signal. **Capture-only; fail-open** |
| `view.mjs` | renders `record/` into a readable HTML page |
| `sync.mjs` | (dormant) record→Supabase upsert; the future Data-Layer transport, not wired today |
| `*.test.mjs` | node:test coverage for the above |

## Run it

```bash
node harness/loop/signal-ledger/ledger.mjs            # status + gaps
node harness/loop/signal-ledger/ledger.mjs rebuild    # rebuild state/os.db
node harness/loop/signal-ledger/view.mjs --out /tmp/flow.html
node --test harness/loop/signal-ledger/*.test.mjs
```

## Wiring

`.claude/settings.json` wires `intake.mjs` to **UserPromptSubmit**. Capture is **observe-only and
fail-open**: it appends one signal to the gitignored `record/signals.jsonl` and stops — **no commit,
no push, every turn.** That keeps the loop quiet: no per-turn commits, no PR pollution, no Stop-hook
nags, across all sessions.

**Getting signals to the Data Layer (Supabase) is deferred** until the Data Layer is formed with a
real transport. `git push` as transport was a stopgap and is retired; `sync.mjs` + the
`sync-signals.yml` workflow remain as dormant references for that future work.

**Next:** per-tool granularity (`PostToolUse`); a `SessionStart` sweep that rebuilds the projection
and raises an incident on any gap/drop; the real Data-Layer transport.
