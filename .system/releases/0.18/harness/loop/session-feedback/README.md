# session-feedback — CANDIDATE (not admitted)

The hook that makes the loop **visible**. Wired on `UserPromptSubmit` in
[`.claude/settings.json`](../../../.claude/settings.json): when you type a command, it runs
the orchestrator loop on your prompt and prints the trace back into the session.

```
🔁 OS loop  signal extracted (#7)  ·  classified → check (high) → doctor  ·
            estimated 61 (medium)  ·  routed → doctor  ·  outcome: completed
```

Try it without a session:
```sh
printf '{"prompt":"check drift"}' | node index.mjs
node index.mjs --text "the deploy failed"     # → routed → investigator · outcome: unknown (honest: no live handler)
```

- **Watch it work** — every prompt visibly passes through extract → classify → estimate →
  route → outcome. This is the primary acceptance test for the rebuild.
- **Fail-open** — any error is swallowed; the turn proceeds untouched. Observability, never a gate.
- **Without fail** — the trace reproduces for the same input (only the `#n` index varies).
- **Sole writer** of `record/signals.jsonl` (the `signal-ledger` candidate is not wired alongside it).

Tests: `session-feedback.test.mjs`. Loop map: [`../LOOP.md`](../LOOP.md).
