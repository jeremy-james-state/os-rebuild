# Definition: agent

**An agent is a `runner` with the *agent role*** — an LLM-driven runner that the
orchestrator dispatches. It is **not a folder or a type**; "agent" is a role
derived from the schema (a runner that an orchestrator dispatches). (AI sense, not
`http.Agent`.) Vocabulary: `docs/VOCABULARY.md`.

## An agent has two parts

| Part | Lives in | Is |
|---|---|---|
| **code** | `harness/runners/<agent>/` | the executing runner — *in* the harness |
| **definition** | `governance/agents/<agent>.md` | role, goal, prompt, gates, lifecycle — data the harness reads; *the law it runs under* |

So an agent straddles the boundary by design: its **code is the harness**, its
**definition is governance**. Each is governed and versioned separately.

## Agent lifecycle (parallel to component status)

`candidate → proposed → staged → testing → approved → active → deprecated`

An agent only becomes `active` (dispatched on real work) after it passes its
evidence gate. Promotion is explicit and recorded — like any governance change.

## The roster (recovered from `os-v1` in the `os-archive` repo, reconciled)

The canonical stack — **understand · construct · manage**, plus bookends:

| Agent | One question / goal | Plane |
|---|---|---|
| **Clarifier** (Framer) | where are we, where to, defined enough? → grounded End State | understand |
| **Scoper** | what do we commit to, what's in/out/deferred? | construct |
| **Planner** | what closes the gap? → atomic, ordered plan | construct |
| **Executor** | carry out one atomic step (the hands) | construct |
| **Testing** (Tester) | is the End State truly met — what breaks it? **independent, adversarial** | manage |
| **Overseer** (`ov`) | what changed, what's visible, what's next — convergence, gate truth, STATUS | manage |
| **Orchestrator** (`orch`) | which agent runs now, route + synchronise | manage |
| *Provisioner · Builder · Deployer* | prep env · coordinate the build · ship (gated) | construct (execution half) |
| *Investigator* (conditional) | what info best reduces uncertainty? | front |
| *Idea-generation* (front) · *Learning* (back) · *Researcher* · *Explainer* · *Nightly Optimizer* | divergent ideation · reflective lessons · cited notes · emit a Frame · find 10x inefficiencies | bookends / knowledge |

These are already in `harness/manifest.json` (kind `engine-agent`, currently
`planned`). Stage 2 makes them first-class: a runner component in `harness/runners/`
+ a definition in `governance/agents/` + a lifecycle state.

## Disciplines that keep them distinct (do not fold)

- **Testing is independent** — the builder/governor must not grade its own work.
- **Doing ≠ deciding** — the Executor acts; the Planner decides what to do.
- **Overseer = WHAT/when · Orchestrator = WHO/how** — priority vs assignment.
- An agent earns its existence only by owning a reasoning question no other agent
  can answer.

Sources (in the [`os-archive`](https://github.com/jeremy-james-state/os-archive) repo): `os-v1/decisions/decision-agent-planes-2026-06-20.md`,
`os-v1/specs/agent-definitions-2026-06-22.md`.
