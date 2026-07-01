# investigator — CANDIDATE agent (code-side)

> The **code half** of the Investigator agent. Its **definition** (the law it runs under — goal,
> prompt, gates, lifecycle) lives in [`governance/agents/investigator.md`](../../../governance/agents/investigator.md).
> An agent straddles the boundary by design: code here, definition in governance.
> Candidate — **not admitted**; when admitted it moves to `harness/runners/investigator/`.

## What "the code" is, honestly

An LLM agent in this harness is mostly **prompt + gates**, not a big script. So its three moving
parts are:

| Part | Where |
|---|---|
| **Law / prompt** | `governance/agents/investigator.md` |
| **Dispatch** | `.claude/commands/incident.md` — the `/incident` command spawns a bounded subagent with that law (in lieu of an orchestrator, for now) |
| **Exit** | `apps/_drafts/incident/incident.mjs` `isComplete` — the deterministic acceptance gate |

`contract.json` declares the bounds (input/output/reads/writes/triggers/exit). That's what makes
it *contained*: a one-shot runner that reads context, writes exactly one incident file, and **runs
until `isComplete`, then stops** — passing the governability test (Bound · Observable · Triggerable
· Clear Exit · Tested).

## Why there's no `index.mjs` yet

Dispatch happens through Claude Code's subagent mechanism, driven by the `/incident` command — not
by a standalone module. A real `harness/runners/investigator/index.mjs` arrives when there's an
**orchestrator** to dispatch it programmatically (the `classify → route` bricks). Until then the
command is the dispatcher and this folder is the registered, contracted candidate.
