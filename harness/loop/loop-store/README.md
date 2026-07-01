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

Read it like a human. The `session-feedback` hook **auto-projects** `state/os.db` every turn,
so it stays current; you can also rebuild it by hand with `node index.mjs project`.

```sh
sqlite3 state/os.db '.tables'                 -- events + a view per node + the `loop` view
sqlite3 -header -column state/os.db 'select * from loop;'   -- one row per command, the whole journey:
--   signal                  | type     | confidence | score | band   | target       | status
--   check the harness…      | check    | high       | 61    | medium | doctor       | completed
--   the deploy failed       | incident | high       | 73    | high   | investigator | unknown
sqlite3 -header -column state/os.db 'select n,summary,target,status from runs;'   -- one node
```

Key loop fields (`type, confidence, target, score, band, signal`) are **promoted to columns**
(not just buried in `payload`), so queries read plainly.

- **Truth-first** — JSONL appended before the projection. A failed write lands in
  `state/loop-store-drops.jsonl` (nothing silent). The index `n` is **gapless** — gaps are
  a detectable completeness failure.
- **Sole-writer per stream** — the data-layer rule. `governance-ledger` is deliberately *not*
  a loop stream (it keeps its own shape + human gate).

Status: **Green** candidate. Tests: `loop-store.test.mjs`. Role in the loop: [`../LOOP.md`](../LOOP.md).
