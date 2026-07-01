# OS Harness — Component Index (generated)

> Generated from `harness/manifest.json` by `harness/render.mjs`.
> Do not edit by hand — edit the JSON and run `node harness/render.mjs --index`.

### orchestrator (6)

| Component | Version | State | Kind | Path | Role |
| --- | --- | --- | --- | --- | --- |
| auto-mode | 0.1.0 | planned | runtime | `harness/loop/auto-mode/` | Away-work runner: select reversible/valuable units -> playback -> runtime select -> fan out thin workers under a concurrency cap |
| builder | 0.1.0 | planned | engine-agent | `harness/loop/builder/` | Coordinates plan execution: build-gate -> provision -> topo-sort -> per-step execute/verify/retry/reframe/escalate -> acceptance |
| orchestrator | 0.1.4 | candidate | router | `harness/loop/orchestrator/` | Routes each step to the cheapest sufficient execution tier (script/subagent/model); logs audit trail; loop/stop control |
| overseer | 0.1.0 | planned | governance | `harness/loop/overseer/` | Management agent: scheduling (DAG/critical path), determinism audit, scope-creep, convergence, snapshot |
| pipeline | 0.1.2 | candidate | runtime | `apps/_drafts/pipeline/` | Deterministic clarify->scope->plan->build->test->deploy chain with per-stage gates, budget, and chain-run persistence |
| router | 0.1.2 | staging | orchestrator | `harness/loop/router.mjs` | Minimal orchestrator: classify a signal, route it to a component, record a terminal outcome (the first wired path) |

### runner (23)

| Component | Version | State | Kind | Path | Role |
| --- | --- | --- | --- | --- | --- |
| approval-runner | 0.1.0 | planned | governance | `apps/approval-runner/` | Turns template/git/host-capability signals into durable approval records (SQLite + JSONL); exact-file commits on session branches only |
| chain-state-attest | 0.1.0 | planned | governance | `apps/chain-state-attest/` | Deterministic digest over STATUS chain/pre-frame/queue; blocks chain edits unless attestation matches HEAD |
| clarifier | 0.1.0 | planned | engine-agent | `apps/clarifier/` | Transcript/request -> grounded End State (goal, conditions, assumptions, definition of done) |
| decision-enforcer | 0.1.0 | planned | governance | `apps/decision-enforcer/` | Pre-push gate: status truth, session registry, live-path, branch ownership, post-handoff, write-branch, template conformance, chain-state attestation |
| decomposer | 0.1.0 | planned | engine-agent | `apps/decomposer/` | Top-down task-tree builder: confidence gate -> cut -> atomicity -> depth budget -> store -> dependencies |
| deployer | 0.1.0 | planned | engine-agent | `apps/deployer/` | Deploy gate + sign-off + verify + auto-rollback; auto only for preview/staging/non-client/low-impact |
| executor | 0.1.0 | planned | engine-agent | `apps/executor/` | Executes one atomic step: mechanical -> template codegen, novel -> model; confines writes to worktree |
| explainer | 0.1.0 | planned | experiment | `apps/explainer/` | Explains a target file as a Frame; grounded, never invents |
| harness-doctor | 0.3.4 | staging | governance | `governance/checks/doctor.mjs` | Drift-check: validates this manifest against disk, wiring, environment, and the production-never-depends-on-sandbox rule |
| interface-build | 0.1.0 | retired | experiment | `interface-build/` | Legacy work-tracker UI design-system build |
| investigator | 0.1.1 | candidate | engine-agent | `apps/_drafts/investigator/` | The first agent: an LLM-driven runner that investigates and fills an incident — evidence-based root cause + the five steps |
| nightly | 0.1.0 | planned | experiment | `apps/nightly/` | Retrospective optimizer: combs prior-day agent_runs for inefficiencies; proposes, never auto-applies |
| planner | 0.1.0 | planned | engine-agent | `apps/planner/` | Scope -> atomic, ordered, rubric-checked build plan |
| provisioner | 0.1.0 | planned | tool | `apps/provisioner/` | Prepares an isolated git worktree as a build target; teardown |
| reducer | 0.1.0 | planned | store | `apps/reducer/` | Stateless read model: derives current unit state and parent/child tree from the event log |
| repo-hygiene | 0.1.0 | planned | governance | `apps/repo-hygiene/` | Audits and prunes merged session branches/worktrees |
| researcher | 0.1.0 | planned | experiment | `apps/researcher/` | Discovery/research lane: grounded knowledge with cited sources |
| scoper | 0.1.0 | planned | engine-agent | `apps/scoper/` | End State -> bounded, viable Scope (in/out items with traceability) |
| session-governor | 0.1.0 | planned | governance | `apps/session-governor/` | Active-session registry, duplicate-topic collision guard, push visibility, post-handoff write caution |
| spike | 0.1.0 | planned | experiment | `apps/spike/` | Ad-hoc worker stub |
| template-conformance | 0.1.0 | planned | governance | `apps/template-conformance/` | Frame/Scope/Plan must conform to templates; 4 visibility states (hidden-structural, hidden-needs-agent-review, ready-for-human-review, approved); spillover routing |
| tester | 0.1.0 | planned | engine-agent | `apps/tester/` | Whole-build acceptance: rules + deterministic check-generation + adversarial subagent review; never model-verifies |
| write-branch-audit | 0.1.0 | planned | governance | `apps/write-branch-audit/` | Asserts the active session branch matches the git write branch |

### service (5)

| Component | Version | State | Kind | Path | Role |
| --- | --- | --- | --- | --- | --- |
| context-window-monitor | 0.1.0 | planned | observability | `apps/context-window-monitor/` | Polls Claude/Codex transcript telemetry; adaptive rotation thresholds; writes trigger events; can auto-prepare handoff |
| local-tracker-server | 0.1.0 | planned | runtime | `apps/local-tracker-server/` | Zero-dependency SQLite server on port 4319: event store + reducer + overseer loop; spawns decomposer/judge/learning workers |
| loop-store | 0.1.3 | candidate | store | `harness/loop/loop-store/` | The data layer: append-only JSONL truth per stream → readable state/os.db; sole-writer per stream |
| reconciler | 0.1.2 | candidate | observability | `harness/loop/reconciler/` | Sweeps the data layer for any signal with no terminal run (limbo) → raises an incident; the nothing-fails-silently backstop |
| store | 0.1.0 | planned | store | `apps/store/` | Append-only event store (work.db) + observation store (obs.db: flags, agent_runs, chain_runs) |

### hook (8)

| Component | Version | State | Kind | Path | Role |
| --- | --- | --- | --- | --- | --- |
| approve-hook | 0.1.0 | planned | hook | `harness/loop/approve-hook/` | UserPromptSubmit hook intercepting 'approve <item> <stage>' prompts |
| away-gate | 0.1.0 | planned | hook | `harness/loop/away-gate/` | PreToolUse safety gate for Auto Mode: allow read/test/git-safe/draft, deny deploy/external-send/money/destructive |
| capture-hook | 0.1.0 | planned | hook | `harness/loop/capture-hook/` | UserPromptSubmit hook for +task / +list instant capture (no model turn) |
| confinement | 0.3.3 | candidate | gate | `harness/guard/confinement/` | PreToolUse fence: blocks tool calls targeting sibling projects (preventive tier; hardening tracked in the confinement-sandbox spec) |
| harness-lock | 0.2.3 | candidate | gate | `harness/guard/harness-lock/` | PreToolUse write-lock: a WRITE to a harness component acquires/refreshes the component's single-writer lock; a WRITE colliding with a LIVE foreign lock is blocked. Control: fail-closed on a live conflict, fail-open on any guard error. |
| pre-push-hook | 0.1.0 | planned | hook | `harness/loop/pre-push-hook/` | Git pre-push entry point that delegates to decision-enforcer |
| session-feedback | 0.1.3 | candidate | hook | `harness/loop/session-feedback/` | UserPromptSubmit hook: runs the loop on the prompt and prints the trace into the session; fail-open |
| session-start-hook | 0.1.0 | planned | hook | `harness/loop/session-start-hook/` | SessionStart: validate workspace binding, fail-closed on wrong checkout, inject continuity packet |

### library (15)

| Component | Version | State | Kind | Path | Role |
| --- | --- | --- | --- | --- | --- |
| build-templates | 0.1.0 | planned | tool | `harness/lib/build-templates/` | Bounded catalog of deterministic codegen templates |
| clarifier-eval | 0.1.0 | planned | experiment | `harness/lib/clarifier-eval/` | Clarifier gate bake-off corpus and calibration |
| clarify-gate | 0.1.0 | planned | gate | `harness/lib/clarify-gate/` | Pre-Orchestrator classifier: is the Clarifier worthwhile (fuzzy + grounded)? Routes run-clarifier / gather-info / self-state / ground-first |
| classifier | 0.1.1 | candidate | gate | `harness/loop/classifier/` | Signal classifier: signal → {type,intent,confidence,target}; rules-based, deterministic, LLM-swappable behind the same contract |
| estimator | 0.1.1 | candidate | gate | `harness/loop/estimator/` | Scores a work item so the orchestrator can prioritise — consults only, never dispatches |
| handoff | 0.1.3 | candidate | governance | `apps/_drafts/handoff/` | Deterministic handoff spine: guarantees session handoffs are saved to record/handoffs/ (+ renders docs/RESUME-HERE.md); new/check/list. |
| incident | 0.1.3 | candidate | governance | `apps/_drafts/incident/` | Deterministic spine of the incident log: STEPS + missingSteps/isComplete + new/check/list |
| os-publish | 0.2.0 | candidate | gate | `.system/bin/os-publish.mjs` | Sealed-runtime publisher: assembles the release snapshot (.system/releases/<v>/), CUT-THEN-VERIFY (doctor + no-ghost + hostile boot smoke INSIDE the snapshot), atomically repoints current|next; --verify + --boot-check (the boot banner). Fail-closed control. |
| refinement | 0.1.0 | planned | experiment | `harness/lib/refinement/` | Overnight prototype/eval corpus (rubric v2, decomposer prototypes) |
| reshape-rig | 0.1.5 | candidate | gate | `apps/_drafts/reshape-rig/` | Migration test rig for the os-reshape plan: golden-master capture/compare (F5), the §D2 eval battery, fault-injection rigs, the sealed-boot S-matrix (RED until P2), concurrency rigs (RED until P3), scoped grep-gate |
| route | 0.1.0 | planned | router | `harness/lib/route/` | Pure routing policy: tags -> tier ladder; verification never uses model; fail-safe defaults to script |
| signal-ledger | 0.1.2 | candidate | store | `harness/loop/signal-ledger/` | Captures every real input as a four-tuple-stamped signal appended to the gitignored record/signals.jsonl; filters system-injected turns |
| tagger | 0.1.0 | planned | gate | `harness/lib/tagger/` | Signal extractor: derives routing tags from a step (purpose, deterministic, needsIndependence, breadth, heavyOffThread, producesReasoning) |
| tracer | 0.1.2 | candidate | observability | `harness/loop/tracer/` | Cross-cutting trace context: one traceId per signal, one spanId per hop (linked), plus the four-tuple |
| verifier | 0.1.0 | planned | tool | `harness/lib/verifier/` | Runs shell/predicate checks on produced artifacts; honest about unrunnable checks |

