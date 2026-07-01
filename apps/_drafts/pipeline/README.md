# pipeline — CANDIDATE (not admitted)

The **gated work chain** — your approval at each step:

```
pre-frame → frame → scope → design → build → deploy → observe
   └─ gate     └─ gate  …      each gate stops the walk, RECORDED (not a live block)
```

```sh
node index.mjs "add the monitor stage"
#   → awaiting-gate at 'pre-frame'.  Approve with:  node index.mjs approve "work:demo::pre-frame"
node index.mjs approve "work:demo::pre-frame"
node index.mjs "add the monitor stage"        # resumes → awaiting-gate at 'frame'
```

- **Gates are async** — the walk stops and records a `pending` gate; you approve when you
  like (records `approved`); the next run resumes. It never blocks waiting on you.
- **Event-sourced + resumable** — the frontier is derived from the `chain`/`gates` streams,
  so progress survives restarts.
- **No fake runners** — each stage records its *owner* (the `planned` component that will
  execute it once admitted: `clarifier`, `scoper`, `planner`, `executor`, `deployer`, …) and
  a `stub` status. Honest, consistent with the no-ghost-agent guarantee.

`opts.gates` selects which stages need approval (default: all). Tests: `pipeline.test.mjs`.
Loop map: [`../LOOP.md`](../LOOP.md).
