# classifier — CANDIDATE (not admitted)

Second hop of the loop: a **signal → `{ type, intent, confidence, target }`**.

```js
import { classify } from './index.mjs'
classify({ summary: 'check the harness for drift' })
// → { type:'check', intent:'check-drift', confidence:'high', target:'doctor', matchedRule:0 }
```

Rules-based and **deterministic** today (`RULES`, first match wins); the *contract* is
identical for an LLM-backed classifier later — "classifier scores, orchestrator routes".

**Honesty rule:** an unmatched signal returns `type:'unknown', target:'unknown'` at low
confidence. It never invents a target — that is what makes the downstream *no-ghost-agent*
guarantee hold. Confidence (`high|medium|low`) drives routing: high → auto-route,
medium → route + flag, low → ask.

CLI: `node index.mjs "check drift"`. Tests: `classifier.test.mjs`. Loop: [`../LOOP.md`](../LOOP.md).
