# orchestrator — CANDIDATE (not admitted)

The **loop driver** (the scheduler). One signal in → a terminal outcome out, with every hop
traced and recorded:

```
extract → classify → estimate → DISPATCH → outcome (completed | unknown | failed)
```

```sh
node index.mjs --demo "check the harness for drift"
#   1. signal extracted (#1)
#   2. classified → check (high) → doctor
#   3. estimated 61 (medium)
#   4. routed → doctor
#   5. outcome: completed
```

```js
import { runLoop } from './index.mjs'
const r = runLoop({ summary })           // → { outcome, feedback, trace, classification, estimate }
```

- **Closed loop** — every run ends in exactly one of `completed | unknown | failed`. Never open.
- **No ghost dispatch** — `HANDLERS` holds only real handlers (today: `doctor`, the live
  drift-check). An unrecognised target becomes an explicit `unknown` — it cannot fake an agent.
- **Separated powers** — classifier scores the signal, estimator scores the work, orchestrator
  routes. Each hop is one span on one trace; every row carries the four-tuple.

Deterministic when `idGen`/`now` are injected (see tests). Tests: `orchestrator.test.mjs`.
Loop map: [`../LOOP.md`](../LOOP.md).
