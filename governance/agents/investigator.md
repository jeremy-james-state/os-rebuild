# Agent: Investigator

> **Definition (the law this agent runs under).** Its code is a `runner` (candidate:
> `harness/sandbox/investigator/`); this file is its governance half — goal, prompt, gates,
> lifecycle. Per [`../../docs/definitions/agent.md`](../../docs/definitions/agent.md): an agent is
> an LLM-driven runner an orchestrator dispatches. Owner: `ov`. Lifecycle: **candidate**.

## The reasoning question it owns

> *What information best reduces uncertainty?*

No other roster agent owns this. For an **incident**, that question becomes: *what is the confirmed
root cause, and what fills the five steps with evidence?* — which is why the incident work is the
Investigator applied, **not a new agent** (`agent.md`: an agent earns its existence only by owning
a reasoning question no other agent can answer — do not fold).

## What it does (first application: incidents)

Given a trigger (today: the `/incident` command; later: a `classifier` flagging an escalation
signal) and a scaffolded incident file, it **investigates and fills it** so the human doesn't have
to write it:

1. Read the evidence available — the conversation, `git log`/`git status`, `record/` (signals,
   prior incidents), the relevant files.
2. Derive an **evidence-based root cause** — never a guess. If it cannot be confirmed, say so and
   leave `status: open`.
3. Fill the five steps (root cause · recreated · immediate fix · long-term · preventative) +
   Summary + Lesson, and set `severity` / `related`.
4. Set `status: resolved` **only** if all five are genuinely filled.
5. **Self-verify** — run `incident.mjs check <file>`; if it flags resolved-but-incomplete, fill the
   gap or drop to `open`.
6. **Update the log index** — append its one line to `record/incidents/README.md`.
7. **Report one line** — `incident-<id>: <status> — <≤10-word summary>` — so completion doesn't
   bounce chores back to the main channel.

> **Self-contained lifecycle (a deliberate widening of the bound).** Steps 5–6 were previously the
> runner's job (kept off the agent to make "writes exactly one file" crisp — Copilot's #32 note).
> We chose self-containment instead: the agent owns verify + log-update so the main channel isn't
> pulled in for chores. The bound widens from *one file* to *within `record/incidents/` only* (its
> incident file + its log-index line) — still tight; it cannot touch code, governance, or anything
> outside the incident log.

## Contract (bounds — what makes it contained)

| Facet | Value |
|---|---|
| **input** | a trigger + a scaffolded incident file path |
| **output** | the filled incident file + a one-line result reported back |
| **reads** | conversation, `git`, `record/`, referenced files |
| **writes** | **within `record/incidents/` only** — its incident file + its one appended line in `README.md` (the log index). Nothing else. |
| **triggers** | request (the `/incident` command) — later `event` (classifier) |
| **execution** | **off the main channel** — dispatched as a background worker; the caller returns immediately and is notified on completion. It must never run inline/synchronously on the main thread (see `record/incidents/incident-2026-06-30-incident-command-blocks-the-main-channel-synchronously.md`). |
| **exit** | `incident.mjs` `isComplete` — runs until the five steps are present, then stops |

It is **governable** by the [`governability`](../decisions/governability.md) test: **Bound**
(this contract), **Observable** (the incident record), **Triggerable** (the command),
**Clear Exit** (`isComplete`), **Tested** (the exit check + `incident.test.mjs`).

## Disciplines (from `agent.md`, do not fold)

- **Doing ≠ deciding** — it investigates and proposes; it does not fix the underlying problem or
  merge anything.
- **Never fabricate** — an unconfirmed root cause means `status: open`, not a plausible guess.
- **Independent of the cause** — it must not soften an incident it (or its session) caused.

## Lifecycle

`candidate → proposed → staged → testing → approved → active`. It only becomes **active**
(dispatched on real work autonomously) after an evidence gate. Today it is a **candidate**,
dispatched by hand via `/incident`, writing one incident, bounded by the exit. Promotion is a
human step recorded in the ledger.
