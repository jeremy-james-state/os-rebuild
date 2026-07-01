# estimator — CANDIDATE (not admitted)

The runner the orchestrator **consults** to score a work item — *"estimator scores,
scheduler dispatches"* ([VOCABULARY](../../../docs/VOCABULARY.md),
[harness-architecture](../../../docs/architecture/harness-architecture.md)). It scores; it
never dispatches.

```js
import { estimate, rank } from './index.mjs'
estimate({ type:'incident', confidence:'high', target:'investigator' })
// → { score: 75, band:'high', factors:{ value:0.9, conf:1, effort:0.5, readiness:1 } }
rank([...classifiedItems])   // backlog, highest priority first
```

Deterministic rubric — factors each 0..1: **value** (worth doing) · **conf** (classifier
confidence) · **effort** (cost) · **readiness** (is the target a real, reachable component?).
Priority rewards `value·conf` and readiness, penalises effort. Swappable to an LLM scorer
behind the same contract.

CLI: `node index.mjs build high orchestrator`. Tests: `estimator.test.mjs`. Loop: [`../LOOP.md`](../LOOP.md).
