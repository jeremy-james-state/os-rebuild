# reconciler — CANDIDATE (not admitted)

The **nothing-fails-silently** backstop. The orchestrator records a terminal outcome for
every signal it runs — but if a signal was captured and then nothing ran (a crash, a dropped
hop), it sits in **limbo**. The reconciler sweeps for those and **raises an incident**.

```sh
node index.mjs
#   reconcile: 3 signals, 1 limbo → raised incidents:1
#   (exit 3 when limbo found, 0 when clean)
```

```js
import { sweep } from './index.mjs'
sweep()   // → { checked, limbo:[signalId…], raised:[incidentId…] }
```

- **The guarantee, not best-effort** — routing may be best-effort; the reconciler must be
  reliable (out-of-process by design). Silence is impossible.
- **Idempotent** — a signal already covered by a run *or* already raised is never re-raised.

Tests: `reconciler.test.mjs`. Loop map: [`../LOOP.md`](../LOOP.md).
