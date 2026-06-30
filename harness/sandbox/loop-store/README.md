# loop-store — CANDIDATE (not admitted)

The signal loop's **data layer**. JSONL is the truth; SQLite is the readable view.

```
record/<stream>.jsonl   append-only TRUTH   (signals, runs, classified, estimates, reconcile, incidents)
        │  project()
        ▼
state/os.db  table `events` (+ views signals/runs/…)   the READABLE projection (gitignored, rebuildable)
```

```js
import { append, project } from './index.mjs'
append('signals', { summary: 'hello', traceId, session, call: 1 })   // → { ok, n, id:'signals:1' }
project()                                                            // rebuild state/os.db from the JSONL
```

Read it like a human:
```sh
node index.mjs project
sqlite3 ../../../state/os.db '.tables'
sqlite3 ../../../state/os.db 'select stream,n,status,summary from events order by ts;'
```

- **Truth-first** — JSONL appended before the projection. A failed write lands in
  `state/loop-store-drops.jsonl` (nothing silent). The index `n` is **gapless** — gaps are
  a detectable completeness failure.
- **Sole-writer per stream** — the data-layer rule. `governance-ledger` is deliberately *not*
  a loop stream (it keeps its own shape + human gate).

Status: **Green** candidate. Tests: `loop-store.test.mjs`. Role in the loop: [`../LOOP.md`](../LOOP.md).
