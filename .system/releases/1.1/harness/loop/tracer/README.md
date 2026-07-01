# tracer — CANDIDATE (not admitted)

Cross-cutting trace context for the signal loop. One **trace** per signal, one **span**
per hop, the **four-tuple** (`session · run · call · branch`) on every row — so a single
action is followable end-to-end (the OpenTelemetry methodology in
[`governance/decisions/data-layer.md`](../../../governance/decisions/data-layer.md)).

```js
import { newTrace, span, fourTuple, stamp } from './index.mjs'
const t  = newTrace()                 // one trace for this signal
const s1 = span(t,  'extract')        // hop 1
const s2 = span(s1, 'classify')       // hop 2 — linked: s2.parentSpanId === s1.spanId
const row = stamp({ phase: 'received' }, s2, fourTuple({ session, call: 2 }))
```

- **Pure + deterministic-friendly** — `id` and `now` are injectable, so tests pin them.
- `span()` **throws** on a context with no `traceId` — there is no such thing as an untraced hop.

Status: **Green** candidate. CLI smoke: `node index.mjs`. Tests: `tracer.test.mjs`.
Home/role in the loop: [`../LOOP.md`](../LOOP.md).
