# Candidates — code that exists but is not (yet) the harness

The lightweight register of harness **candidates**, per
[`rules/harness-admission.md`](rules/harness-admission.md). A candidate lives in
`harness/sandbox/`, may run, and may even be wired — but it is **not** in the harness
file (`harness/manifest.json`) and **not** in `harness/core/` until a human admits it.

This file is the "Registered" step. When a candidate is **admitted**, it is removed
from here and declared in the harness file; when **withdrawn**, it is removed from here
and deleted from `harness/sandbox/`.

> **Divergence resolved (gov-2026-06-30-031):** the earlier sandbox exception — keeping
> `record/signals.jsonl` tracked as a git→CI→Supabase transport (gov-029) — is **ended**.
> `signals.jsonl` is now gitignored, re-aligned with main's "runtime streams gitignored → Data
> Layer" policy (PR #23). Capture is local-only; reaching the Data Layer is deferred to when it is
> formed with a real transport. The auto-commit/push hook was retired (it caused repo-wide churn).

| Candidate | Location | Does | Step | Notes |
|---|---|---|---|---|
| `signal-ledger` | `harness/sandbox/signal-ledger/` | Captures every real input as a four-tuple-stamped **signal** appended to the gitignored `record/signals.jsonl`, projectable into `state/os.db`, filtering system-injected turns. The first piece of the data layer. | **Green** (awaiting admission) | **Capture-only** via `.claude/settings.json` (append, fail-open — no commit/push). Supabase transport (`sync.mjs` + `sync-signals.yml`) is **dormant** pending Data Layer formation. **Home + roadmap:** [`docs/architecture/signal-loop.md`](../docs/architecture/signal-loop.md). Next stage = classify. Not admitted — see admission rule. |
| `incident` | `harness/sandbox/incident/` | The deterministic spine of the incident log (brought forward from the archived `incident.mjs`, adapted to markdown): `STEPS` + `missingSteps`/`isComplete`, plus `new`/`check`/`list`. Guarantees the 5-step structure and that a `resolved` incident has no empty step. Drives the `/incident` slash command. | **Green** (awaiting admission) | CLI: `node harness/sandbox/incident/incident.mjs new "<title>" \| check [file\|all] \| list`. `check` exits non-zero on a resolved-but-incomplete incident (gate-ready, not yet wired into `governance-check`). Slash command: `.claude/commands/incident.md`. Not admitted — see admission rule. |
| `investigator` | `harness/sandbox/investigator/` | **The first agent.** An LLM-driven runner (role: agent) that investigates and fills an incident — evidence-based root cause + the five steps — so the human doesn't write it. Owns *"what information best reduces uncertainty?"* (roster Investigator, not a new agent). | **Candidate** | Definition (its law): [`governance/agents/investigator.md`](../governance/agents/investigator.md). Dispatched by `/incident` as a **background, self-contained** subagent (off the main channel — fills, self-verifies, updates the log index, reports one line); **exit = `isComplete`**; writes exactly one incident file. Contained per the governability test. Code-side is thin (prompt + dispatch + exit) until an orchestrator exists; then it moves to `harness/runners/investigator/`. Not admitted. |

## The signal loop (the wired, watchable spine)

The closed loop, built to **Green** as candidates. Map: [`../harness/sandbox/LOOP.md`](../harness/sandbox/LOOP.md).
Two guarantees, both enforced + demonstrated: **nothing fails silently** (closed outcomes + `reconciler`)
and **no ghost agents** (`governance/enforcement/no-ghost-agent.mjs` + the dispatcher's `unknown` fallback).

| Candidate | Location | Does | Step | Notes |
|---|---|---|---|---|
| `tracer` | `harness/sandbox/tracer/` | Cross-cutting trace context: one `traceId` per signal, one `spanId` per hop (linked), plus the four-tuple. Pure, deterministic-friendly. | **Green** | The thread that makes a run followable end-to-end. Tests: `tracer.test.mjs`. |
| `loop-store` | `harness/sandbox/loop-store/` | The data layer: append-only JSONL truth per stream (`signals,runs,classified,estimates,reconcile,incidents`) → readable `state/os.db` `events` table (+ views). Generalises `signal-ledger`. | **Green** | Sole-writer per stream; truth-first; gapless index; nothing fails silently. Tests: `loop-store.test.mjs`. |
| `classifier` | `harness/sandbox/classifier/` | signal → `{type,intent,confidence,target}`. Rules-based + deterministic; LLM-swappable behind the same contract. | **Green** | Unmatched → explicit `unknown` (never a fabricated target). Tests: `classifier.test.mjs`. |
| `estimator` | `harness/sandbox/estimator/` | Scores a work item so the orchestrator can prioritise — *"estimator scores, scheduler dispatches"*. | **Green** | Consults only; never dispatches. Deterministic rubric. Tests: `estimator.test.mjs`. |
| `orchestrator` | `harness/sandbox/orchestrator/` | The loop driver / dispatcher: extract→classify→estimate→route→terminal outcome, traced; records every run. | **Green** | Dispatches only to real handlers (today: `doctor`); unknown target → `unknown`, never faked. Tests: `orchestrator.test.mjs`. |
| `reconciler` | `harness/sandbox/reconciler/` | Sweeps the data layer for any signal with no terminal run (limbo) → raises an incident. | **Green** | The nothing-fails-silently backstop; idempotent. Tests: `reconciler.test.mjs`. |
| `session-feedback` | `harness/sandbox/session-feedback/` | UserPromptSubmit hook: runs the loop on your prompt and prints the trace into the session. **Wired** in `.claude/settings.json`. | **Green** | Fail-open; sole writer of `record/signals.jsonl` (signal-ledger not wired alongside). Tests: `session-feedback.test.mjs`. |
| `pipeline` | `harness/sandbox/pipeline/` | The **gated work chain** `pre-frame → frame → scope → design → build → deploy → observe`. Stops at each gate awaiting your approval — recorded (async), never a live block. Event-sourced + resumable. | **Green** | Stages never fake a runner — each names its owning `planned` component + a `stub` status. Tests: `pipeline.test.mjs`. |
