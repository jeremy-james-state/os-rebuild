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
