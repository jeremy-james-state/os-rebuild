# The signal loop — map

The closed loop, wired and running as **candidates** in `harness/sandbox/`. Every input
becomes a signal, traverses the nodes, and reaches a terminal outcome. **Nothing fails
silently; no agent is referenced that isn't really there.**

```
            you type a command
                   │
        ┌──────────▼───────────┐   .claude/settings.json (UserPromptSubmit)
        │  session-feedback     │   prints the trace into the session
        │  (hook)               │
        └──────────┬───────────┘
                   │ runs
        ┌──────────▼───────────────────────────────────────────────────────┐
        │  orchestrator  (the loop driver / scheduler)                       │
        │                                                                    │
        │   extract ──► classify ──► estimate ──► route ──► outcome          │
        │     │            │            │           │          │             │
        └─────┼────────────┼────────────┼───────────┼──────────┼─────────────┘
              │            │            │           │          │
        ┌─────▼───┐  ┌─────▼─────┐ ┌────▼─────┐ (dispatch    completed │ unknown │ failed
        │ extract │  │ classifier│ │ estimator│  table:       │
        │ (signal)│  │           │ │          │  real          ▼
        └─────┬───┘  └─────┬─────┘ └────┬─────┘  handlers   ┌───────────┐
              │            │            │        only)      │ reconciler │ sweeps for
              ▼            ▼            ▼                    │ (backstop) │ limbo → incident
        record/signals  classified  estimates  record/runs  └───────────┘
              └────────────┴────────────┴───────────┴──────────► loop-store
                                                                  │ project()
                                                                  ▼
                                                      state/os.db  (readable SQLite)
```

Every hop opens a span on one **trace** (`tracer`) and writes a four-tuple-stamped row
through the **loop-store** (the data layer). `state/os.db` is the readable projection.

## The pieces

| Piece | Type | Step | Writes (stream) | Tests |
|---|---|---|---|---|
| `tracer` | library | (cross-cutting) trace + four-tuple | — | `tracer.test.mjs` |
| `loop-store` | service | the data layer (JSONL truth → SQLite) | all streams | `loop-store.test.mjs` |
| `session-feedback` | hook | the visible door (UserPromptSubmit) | `signals` | `session-feedback.test.mjs` |
| `orchestrator` | orchestrator | the loop driver / dispatcher | `signals,classified,estimates,runs` | `orchestrator.test.mjs` |
| `classifier` | runner | classify | `classified` | `classifier.test.mjs` |
| `estimator` | runner | estimate (scores work) | `estimates` | `estimator.test.mjs` |
| `reconciler` | runner | reconcile (no-limbo backstop) | `incidents` | `reconciler.test.mjs` |
| `signal-ledger` | service | (reference capture variant, **not wired**) | — | (v2) |
| `investigator` | runner (agent) | the first real LLM agent (Tier C) | `record/incidents/*.md` | (v2) |

Enforcement (governance/enforcement): `doctor` · `governance-check` · `structure-check` ·
**`no-ghost-agent`** (every routing target resolves to something real).

## The two guarantees

- **Nothing fails silently** — the orchestrator records exactly one terminal outcome
  (`completed | unknown | failed`) per signal; the `reconciler` raises any signal that
  somehow never got one.
- **No ghost agents** — the dispatcher routes only to real handlers; an unrecognised target
  becomes an explicit `unknown`. The `no-ghost-agent` check fails the build if any routing
  target resolves to nothing real.

## Run it

```sh
node harness/sandbox/orchestrator/index.mjs --demo "check the harness for drift"
printf '{"prompt":"the deploy failed"}' | node harness/sandbox/session-feedback/index.mjs
node harness/sandbox/loop-store/index.mjs project && sqlite3 state/os.db \
  'select stream,n,status,summary from events order by ts;'
node harness/sandbox/reconciler/index.mjs            # raises any limbo signal
node governance/enforcement/no-ghost-agent.mjs        # proves no fabricated targets
```

These are **candidates** (`governance/rules/harness-admission.md`): built to **Green**,
awaiting human admission. See [`governance/candidates.md`](../../governance/candidates.md).
