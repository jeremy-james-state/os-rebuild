# OS Harness — Manifest (generated)

> Generated from `harness/manifest.json` by `harness/render.mjs`.
> Do not edit by hand — edit the JSON and run `node harness/render.mjs --write`.

**Harness version:** 0.20 · **Manifest format:** 2.0 · **Updated:** 2026-06-30

## Boundary

- **Model:** directory+manifest, one branch; lifecycle state DECOUPLED from location
- **Production:** harness/ (kernel: loop/ + guard/) and apps/ (userland; one folder per app)
- **Sandbox:** apps/_drafts/
- **Note:** Type is a field, not a folder. Candidates live in apps/_drafts/ (apps) or in harness/loop|guard/ with state=candidate (kernel parts awaiting admission). Admission = a human-reviewed manifest state flip (+ move out of _drafts/ for apps) — never a self-admitted state edit; CODEOWNERS gates the manifest.

## Sequence — the shape (session → … → observe)

The blueprint — the harness's canonical end-to-end shape: session -> idea -> understand -> shape -> execute -> assure -> ship -> observe. Each step maps to a declared component and/or chain stage. This is the harness's testable shape (the 'blueprint'), distinct from the 'chain' (the build-pipeline stages it wraps); the doctor checks that every step resolves and that no production step depends on a sandbox component.

| # | Phase | Step | Maps to | Produces |
| --- | --- | --- | --- | --- |
| 1 | intake | session-start | component:session-start-hook | bound session + injected continuity |
| 2 | intake | capture | component:capture-hook / stage:idea | captured unit in the tracker |
| 3 | understand | signal-extract | component:tagger | routing signal / tags |
| 4 | understand | classify | component:clarify-gate | clarifier-worthwhile decision |
| 5 | understand | frame | component:clarifier / stage:frame | grounded End State |
| 6 | shape | scope | component:scoper / stage:scope | bounded, viable scope |
| 7 | shape | plan | component:planner / stage:plan | atomic, ordered plan |
| 8 | execute | route | component:orchestrator | per-step tier routing |
| 9 | execute | build | component:builder / stage:build | built artifacts in an isolated target |
| 10 | assure | assure | component:tester / stage:test | testing-gate verdict (>=8/10) |
| 11 | ship | ship | component:deployer / stage:deploy | deployment + verify + rollback |
| 12 | observe | observe | stage:monitor | (MISSING) post-deploy monitoring + feedback into new units |

## Components by state

### staging (2)

| Component | Type | Kind | Path | Role |
| --- | --- | --- | --- | --- |
| harness-doctor | runner | governance | `governance/checks/doctor.mjs` | Drift-check: validates this manifest against disk, wiring, environment, and the production-never-depends-on-sandbox rule  ⚠ new in this pass; not yet wired into pre-push |
| router | orchestrator | orchestrator | `harness/loop/router.mjs` | Minimal orchestrator: classify a signal, route it to a component, record a terminal outcome (the first wired path)  ⚠ minimal first wiring; dispatch table still hard-coded — deriving it from the manifest census is a later wiring step |

### candidate (16)

| Component | Type | Kind | Path | Role |
| --- | --- | --- | --- | --- |
| classifier | library | gate | `harness/loop/classifier/` | Signal classifier: signal → {type,intent,confidence,target}; rules-based, deterministic, LLM-swappable behind the same contract |
| confinement | hook | gate | `harness/guard/confinement/` | PreToolUse fence: blocks tool calls targeting sibling projects (preventive tier; hardening tracked in the confinement-sandbox spec) |
| estimator | library | gate | `harness/loop/estimator/` | Scores a work item so the orchestrator can prioritise — consults only, never dispatches |
| handoff | library | governance | `apps/_drafts/handoff/` | Deterministic handoff spine: guarantees session handoffs are saved to record/handoffs/ (+ renders docs/RESUME-HERE.md); new/check/list. |
| harness-lock | hook | gate | `harness/guard/harness-lock/` | PreToolUse write-lock: a WRITE to a harness component acquires/refreshes the component's single-writer lock; a WRITE colliding with a LIVE foreign lock is blocked. Control: fail-closed on a live conflict, fail-open on any guard error. |
| incident | library | governance | `apps/_drafts/incident/` | Deterministic spine of the incident log: STEPS + missingSteps/isComplete + new/check/list |
| investigator | runner | engine-agent | `apps/_drafts/investigator/` | The first agent: an LLM-driven runner that investigates and fills an incident — evidence-based root cause + the five steps |
| loop-store | service | store | `harness/loop/loop-store/` | The data layer: append-only JSONL truth per stream → readable state/os.db; sole-writer per stream |
| orchestrator | orchestrator | router | `harness/loop/orchestrator/` | Routes each step to the cheapest sufficient execution tier (script/subagent/model); logs audit trail; loop/stop control |
| os-publish | library | gate | `.system/bin/os-publish.mjs` | Sealed-runtime publisher: assembles the release snapshot (.system/releases/<v>/), CUT-THEN-VERIFY (doctor + no-ghost + hostile boot smoke INSIDE the snapshot), atomically repoints current|next; --verify + --boot-check (the boot banner). Fail-closed control. |
| pipeline | orchestrator | runtime | `apps/_drafts/pipeline/` | Deterministic clarify->scope->plan->build->test->deploy chain with per-stage gates, budget, and chain-run persistence |
| reconciler | service | observability | `harness/loop/reconciler/` | Sweeps the data layer for any signal with no terminal run (limbo) → raises an incident; the nothing-fails-silently backstop |
| reshape-rig | library | gate | `apps/_drafts/reshape-rig/` | Migration test rig for the os-reshape plan: golden-master capture/compare (F5), the §D2 eval battery, fault-injection rigs, the sealed-boot S-matrix (RED until P2), concurrency rigs (RED until P3), scoped grep-gate |
| session-feedback | hook | hook | `harness/loop/session-feedback/` | UserPromptSubmit hook: runs the loop on the prompt and prints the trace into the session; fail-open |
| signal-ledger | library | store | `harness/loop/signal-ledger/` | Captures every real input as a four-tuple-stamped signal appended to the gitignored record/signals.jsonl; filters system-injected turns |
| tracer | library | observability | `harness/loop/tracer/` | Cross-cutting trace context: one traceId per signal, one spanId per hop (linked), plus the four-tuple |

### planned (38)

| Component | Type | Kind | Path | Role |
| --- | --- | --- | --- | --- |
| approval-runner | runner | governance | `apps/approval-runner/` | Turns template/git/host-capability signals into durable approval records (SQLite + JSONL); exact-file commits on session branches only  ⚠ no read API / unified violation dashboard yet (Law 11 partial) |
| approve-hook | hook | hook | `harness/loop/approve-hook/` | UserPromptSubmit hook intercepting 'approve <item> <stage>' prompts  ⚠ built but never wired; untested |
| auto-mode | orchestrator | runtime | `harness/loop/auto-mode/` | Away-work runner: select reversible/valuable units -> playback -> runtime select -> fan out thin workers under a concurrency cap  ⚠ approve-mode trusted; tool-use execution trust still pending (Gate B) |
| away-gate | hook | hook | `harness/loop/away-gate/` | PreToolUse safety gate for Auto Mode: allow read/test/git-safe/draft, deny deploy/external-send/money/destructive  ⚠ snippet exists but not merged into an active settings.json -> not wired by default |
| build-templates | library | tool | `harness/lib/build-templates/` | Bounded catalog of deterministic codegen templates |
| builder | orchestrator | engine-agent | `harness/loop/builder/` | Coordinates plan execution: build-gate -> provision -> topo-sort -> per-step execute/verify/retry/reframe/escalate -> acceptance |
| capture-hook | hook | hook | `harness/loop/capture-hook/` | UserPromptSubmit hook for +task / +list instant capture (no model turn)  ⚠ untested |
| chain-state-attest | runner | governance | `apps/chain-state-attest/` | Deterministic digest over STATUS chain/pre-frame/queue; blocks chain edits unless attestation matches HEAD |
| clarifier | runner | engine-agent | `apps/clarifier/` | Transcript/request -> grounded End State (goal, conditions, assumptions, definition of done)  ⚠ two meanings stores (clarifier.db vs confirmed-meanings.db) pending unification |
| clarifier-eval | library | experiment | `harness/lib/clarifier-eval/` | Clarifier gate bake-off corpus and calibration  ⚠ ~15M; candidate for sandbox/ relocation |
| clarify-gate | library | gate | `harness/lib/clarify-gate/` | Pre-Orchestrator classifier: is the Clarifier worthwhile (fuzzy + grounded)? Routes run-clarifier / gather-info / self-state / ground-first |
| context-window-monitor | service | observability | `apps/context-window-monitor/` | Polls Claude/Codex transcript telemetry; adaptive rotation thresholds; writes trigger events; can auto-prepare handoff |
| decision-enforcer | runner | governance | `apps/decision-enforcer/` | Pre-push gate: status truth, session registry, live-path, branch ownership, post-handoff, write-branch, template conformance, chain-state attestation  ⚠ only fires if core.hooksPath is configured; not configured in fresh clones / cloud |
| decomposer | runner | engine-agent | `apps/decomposer/` | Top-down task-tree builder: confidence gate -> cut -> atomicity -> depth budget -> store -> dependencies |
| deployer | runner | engine-agent | `apps/deployer/` | Deploy gate + sign-off + verify + auto-rollback; auto only for preview/staging/non-client/low-impact  ⚠ built but not wired into a live flow; no formal Deploy stage contract yet |
| executor | runner | engine-agent | `apps/executor/` | Executes one atomic step: mechanical -> template codegen, novel -> model; confines writes to worktree |
| explainer | runner | experiment | `apps/explainer/` | Explains a target file as a Frame; grounded, never invents  ⚠ built but never called by any live flow |
| local-tracker-server | service | runtime | `apps/local-tracker-server/` | Zero-dependency SQLite server on port 4319: event store + reducer + overseer loop; spawns decomposer/judge/learning workers |
| nightly | runner | experiment | `apps/nightly/` | Retrospective optimizer: combs prior-day agent_runs for inefficiencies; proposes, never auto-applies  ⚠ no scheduled job registered |
| overseer | orchestrator | governance | `harness/loop/overseer/` | Management agent: scheduling (DAG/critical path), determinism audit, scope-creep, convergence, snapshot |
| planner | runner | engine-agent | `apps/planner/` | Scope -> atomic, ordered, rubric-checked build plan |
| pre-push-hook | hook | hook | `harness/loop/pre-push-hook/` | Git pre-push entry point that delegates to decision-enforcer  ⚠ core.hooksPath NOT configured by default -> hook may not fire; install-managed-hooks.sh is manual |
| provisioner | runner | tool | `apps/provisioner/` | Prepares an isolated git worktree as a build target; teardown  ⚠ not yet called by Builder |
| reducer | runner | store | `apps/reducer/` | Stateless read model: derives current unit state and parent/child tree from the event log |
| refinement | library | experiment | `harness/lib/refinement/` | Overnight prototype/eval corpus (rubric v2, decomposer prototypes)  ⚠ ~26M generated artifacts; candidate for sandbox/ relocation |
| repo-hygiene | runner | governance | `apps/repo-hygiene/` | Audits and prunes merged session branches/worktrees |
| researcher | runner | experiment | `apps/researcher/` | Discovery/research lane: grounded knowledge with cited sources  ⚠ schema only; no agent entry point; unwired |
| route | library | router | `harness/lib/route/` | Pure routing policy: tags -> tier ladder; verification never uses model; fail-safe defaults to script |
| scoper | runner | engine-agent | `apps/scoper/` | End State -> bounded, viable Scope (in/out items with traceability) |
| session-governor | runner | governance | `apps/session-governor/` | Active-session registry, duplicate-topic collision guard, push visibility, post-handoff write caution |
| session-start-hook | hook | hook | `harness/loop/session-start-hook/` | SessionStart: validate workspace binding, fail-closed on wrong checkout, inject continuity packet  ⚠ hardcodes local path -> fails closed in cloud context; must move to repo-identity (both-first-class decision) |
| spike | runner | experiment | `apps/spike/` | Ad-hoc worker stub |
| store | service | store | `apps/store/` | Append-only event store (work.db) + observation store (obs.db: flags, agent_runs, chain_runs) |
| tagger | library | gate | `harness/lib/tagger/` | Signal extractor: derives routing tags from a step (purpose, deterministic, needsIndependence, breadth, heavyOffThread, producesReasoning) |
| template-conformance | runner | governance | `apps/template-conformance/` | Frame/Scope/Plan must conform to templates; 4 visibility states (hidden-structural, hidden-needs-agent-review, ready-for-human-review, approved); spillover routing |
| tester | runner | engine-agent | `apps/tester/` | Whole-build acceptance: rules + deterministic check-generation + adversarial subagent review; never model-verifies |
| verifier | library | tool | `harness/lib/verifier/` | Runs shell/predicate checks on produced artifacts; honest about unrunnable checks |
| write-branch-audit | runner | governance | `apps/write-branch-audit/` | Asserts the active session branch matches the git write branch |

### retired (1)

| Component | Type | Kind | Path | Role |
| --- | --- | --- | --- | --- |
| interface-build | runner | experiment | `interface-build/` | Legacy work-tracker UI design-system build  ⚠ superseded by Dashboard/Command Center direction |

## Work chain (idea → … → monitor)

| Stage | Status | Contract / surface |
| --- | --- | --- |
| idea | present | captured unit, no filing |
| pre-frame | present | decisions/decision-preframe-lifecycle-2026-06-22.md |
| frame | present | specs/template-frame-2026-06-22.md |
| scope | present | specs/template-scope-2026-06-22.md |
| plan | present | specs/template-plan-2026-06-22.md + rubric-plan-quality |
| build | present | builder/builder.mjs |
| test | present | specs/rubric-testing-gate-2026-06-22.md |
| deploy | partial | MISSING formal Deploy stage contract; only checklist-auto-mode-deployment-readiness exists |
| monitor | missing | MISSING — no Monitor stage, template, or post-Done observation loop |

## Environment — determinism gaps

- No .mcp.json -> MCP servers ungoverned
- No tracked settings.json -> hook wiring (the laws' backbone) lives outside the repo
- No skills/plugins manifest -> session capability set is invisible and non-reproducible

## Governance

Three layers: Principles (advisory) -> Laws (programmatic, fail-closed) -> GitHub (platform).

| # | Law | Enforced |
| --- | --- | --- |
| 1 | Session Registry | true |
| 2 | Auto Mode Escape | staging — away-gate not wired by default |
| 3 | Template Conformance | true |
| 4 | Status Truth | true |
| 5 | Session Start Live-Path | needs repo-identity generalization (both-first-class) |
| 6 | Chain State Attestation | true |
| 7 | Post-Handoff Caution | true |
| 8 | Write Branch Audit | true |
| 9 | Duplicate Session Claim | true |
| 10 | GitHub Branch Protection | false |
| 11 | Unified Violation Audit | partial |

**Build rules:**

- A component enters the production harness only via the promotion contract (frame->...->test + human approval).
- Production never depends on sandbox or quarantined components.
- Every harness change is a manifest change; an undeclared wired surface is a drift error.
- The environment (settings/hooks/plugins/skills/MCP/contexts) is pinned in-repo and checked.
- Master is the single source of truth; branches are transient change vehicles merged via PR + protection.

