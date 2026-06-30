# Harness Lifecycle & Knowledge — Reference

**One line.** The harness's job is to turn work into **verified, reusable assets** — via an evidence-gated
lifecycle (work can't advance without proof) and **promotion** (a runtime outcome becomes a durable asset).

## The third "never silent" (same principle, third place)
- no **dead components** (structural) · no **dropped signals** (runtime / closed loop) ·
  **no unproven advancement** (lifecycle): can't claim "built" without tests, "deployed" without proof.
The evidence gate — self-test + rating + adversarial review — is what made the big difference; it's now **mandatory**.

## The lifecycle pipeline (each arrow is an evidence gate the orchestrator enforces)
```
idea → pre-frame → scope → plan → build → deploy → observe → maintain
```
Strong today: pre-frame/scope/plan (clarifier, planner, templates). The gap to build: the **right side** —
**deploy (actually ship), observe (the closed loop), maintain.** No stage advances without its declared evidence.

## The five reusable assets (runtime → durable, via promotion)
| Asset | Captures | Lives in |
|---|---|---|
| **procedure** | a verified recipe + runnable tool + evidence (deploy a DB, deploy to Vercel) | `governance/procedures/` + a `command` in `harness/` + evidence in `record/` |
| **evidence** | tests, scores, adversarial reviews — attached to what they verify | `record/` (append-only, four-tuple) |
| **template** | reusable scaffolds (keep frames simple, give the right info) | `docs/templates/` |
| **rule / principle** | promoted patterns + rules about how rules are written | `governance/rules/` + `docs/principles.md` |
| **knowledge** | concepts, definitions, research — the LLM wiki | `docs/definitions/` (+ `wiki-lint`) |

## The shipping gap → infrastructure-as-verified-procedure
The harness is strong on **think/plan/review** (reads), weak on **do/ship** (writes to the world). Fix:
- a real action runs via a **command (tool component)**; on **success + evidence**, it is **promoted** to a
  **procedure**: `preconditions + steps + the command + expected outputs + attached evidence (the run's four-tuple)`.
- Next time the system **looks it up** and **re-runs the command**, with proof it's been verified before.
- So *"deploy a Postgres DB"* becomes a **one-call verified procedure**, not figure-it-out-fresh. "Evidence is
  runtime but reusable" = the test/score is promoted from a transient run into a durable record attached to the procedure.

## Promotion = generalize the learning-governor
The learning-governor already promotes **corrections → principles**. One promotion engine, many asset types:
`correction → principle · deploy-success → procedure · test-run → attached evidence · research → wiki entry`.
Nothing valuable the system produces is left as a one-off.

## Two locked design calls
1. **Stage gates are mandatory + evidence-typed** — each stage declares *what evidence advances it*
   (`build` → passing tests; `deploy` → a verified procedure + a successful run). Fails closed.
2. **Promotion is explicit + reviewed** — a runtime outcome becomes a durable asset only via a recorded
   promotion (keeps the knowledge base curated, not auto-polluted) — like a component going `in-formation → wired`.

## Recover, don't rebuild (in-repo today)
- pre-frame: `execution/agents/clarifier/` (clarify-gate, grounding, score-endstate, endstate-schema, eval)
- plan/build: `execution/agents/planner/`, `policy/agents/{planner,coding}-agent.md`
- templates: `policy/templates/` (frame / scope / plan / frame-review-gate / proposed-test-gate)
- method: `policy/agents/lifecycle.md`, `policy/design/work-graph-method-*`, `frame-*` / `preframe-*` docs
These are the dead-but-built agents — wiring them via the orchestrator builds the lifecycle on what exists.
