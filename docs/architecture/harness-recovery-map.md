# Harness Recovery Map — what exists, what's staged, what's missing

Recovered from the repo (clarifier, planner, templates, lifecycle). **The lifecycle is mostly designed and
partly built; the gap is wiring + the right-side stages + arming the gates.** Wire, don't rebuild.

## The lifecycle, with real status
| Stage | Template / artifact | Gate (evidence) | Code | Status |
|---|---|---|---|---|
| idea / preframe | tracker DB | capture-only | — | **live** (capture) |
| pre-frame (clarify) | `endstate-schema` (End State) | 3-axis score ≥0.9 + grounding + worthwhile pre-check | `execution/agents/clarifier/` | **built, staged** |
| frame | `template-frame` | `frame-review-gate` (7 checks + no-jargon + adversarial) | framer | candidate (template only) |
| scope | `template-scope` | approve/refine/reject | scoper | candidate (template only) |
| plan | `template-plan` | valid + on-scope + atomic + ordered (work-graph) | `execution/agents/planner/` | **built, staged** |
| spec | `doc-templates` §4 | approve/refine/reject | — | template only |
| build | — | `proposed-test-gate` (10-pt; 8+ = approve; red flags) | `coding-agent.md` | **proposed** |
| test | — | QA + director-of-QA (quality floor) | `qa-agent.md` | proposed |
| decision | `template-adr` (5-lens) | recorded | `design-store` | **live** |
| **deploy** | — | — | — | **MISSING** |
| **observe** | the closed loop (signals) | — | — | **MISSING — designing now** |
| **maintain** | — | — | — | **MISSING** |

*(Parallel: the **agent lifecycle** `candidate→proposed→staged→testing→approved→active→deprecated` governs how each
agent itself gets wired — `policy/agents/lifecycle.md`.)*

## Reusable patterns to preserve (load-bearing, proven)
1. **Deterministic-after-inference** — model *proposes*, deterministic checks *verify* before trust (clarifier scoring, planner `plan-check`). = Principle 10, *checked beats asserted*.
2. **Atomic-step contract** — `{ operation ∈ Find|Shape|Decide|Act, output, test, dependsOn[] }`. The work-item unit the **scheduler** sequences (`dependsOn` = the graph).
3. **Rule vs Judgement** — every condition tagged; a `Judgement` carries a `basis` and **routes to a human**. = the closed-loop routing, already latent.
4. **Severity-gated review, author ≠ approver** — `critical/high` → peer + adversarial + *separate* approver; `medium` → peer; `low` → none. The stage gate, scaled to risk.
5. **Gates as evidence checklists** — deterministic, repeatable rubrics (`frame-review-gate` 7 checks; `proposed-test-gate` 10-pt + mandatory red flags incl. "builder is sole judge of own output"). Not prose approvals.
6. **Dual-store + frontmatter** — markdown (template shape) + auto `artifact-frontmatter/v1` → `state/design.db`. The artifact maturation chain (requirements→scope→plan→spec).
7. **No-jargon standard** — plain meaning before mechanics; *every named term must exist or be flagged as a concept, never presented as built machinery* (the "Trunk Keeper" phantom). = "name your own loop," at the doc level.
8. **Principles + enforcement map** — every principle has an owner + a mechanism, or is marked `pending`; principles are short. *Rules about how rules are written.*
9. **Worthwhile pre-check** — a deterministic gate (`grounded × fuzzy`) before spending a model call.
10. **Grounding (anti-fiction)** — check `currentState` claims against the repo; catch "build from scratch" when code exists.

## The gaps to build (the new architecture's job)
1. **The orchestrator/scheduler** — routes clarify → frame → scope → plan → build → test. *Nothing calls these today; that's why the agents are dead.* (Stage 4.)
2. **The right side** — `deploy` / `observe` / `maintain` stages, + the **landing function** (Trunk-Keeper → a real named agent) and **full-test CI as a required PR check** (flagged as the #1 blocker).
3. **Arm the gates** — warn-first → blocking required checks.
4. **Runtime adapter** — the model-extraction call the clarifier + planner need (disabled by default today).
5. **The promotion engine** — generalize the learning-governor: runtime outcome → reusable asset (deploy-success → procedure, test-run → evidence, research → wiki).

## Bridge
~80% is designed/built (templates, gates, clarifier, planner, work-graph method, dual-store). The missing 20% is
**wiring (the orchestrator), the right-side stages (deploy/observe/maintain), and arming the gates** — which is
exactly what the new architecture (orchestrator + closed loop + evidence-gated lifecycle + promotion) supplies.
