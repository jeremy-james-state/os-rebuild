# Incident — incident command blocks the main channel synchronously (2026-06-30)

- **id:** incident-2026-06-30-incident-command-blocks-the-main-channel-synchronously
- **severity:** low
- **status:** resolved
- **owner:** jeremy (governor) · investigator agent
- **related:** gov-034 (Investigator defined) · gov-035 / `platform-home.md` (runtime home) · this PR (fix) · the log's first self-caught design issue

## Summary

The first real use of `/incident` hung the main channel for ~a minute. The command dispatched the
**Investigator subagent synchronously** — the main loop waited inline while the agent investigated
(an LLM doing multi-step work). The user interrupted; nothing persisted (clean tree, no scaffolded
file, no orphaned process). Caught by use, not by a check.

## The five steps

> An incident is done only when all five are present.

1. **Root cause** — A lifecycle/command action ran an LLM **agent inline on the main channel**:
   `/incident`'s step 2 dispatched the Investigator via a *synchronous* subagent, so the main loop
   blocked for the full duration of the investigation. Evidence: `incident.mjs list`/`check` return
   instantly (the script is not the hang); nothing was scaffolded or left running, so the wait was
   the agent dispatch itself, not the deterministic parts.
2. **Recreated** — On a tree with the `/incident` command: run `/incident <title>`. The scaffold is
   instant, then the turn hangs ~1 minute while the Investigator subagent runs inline. Interrupting
   leaves no trace.
3. **Immediate fix** — *(this PR)* `/incident` now dispatches the Investigator as a **background**
   subagent and **returns immediately** ("filed; investigating in the background, will report
   back"). The investigation runs off-thread; the command no longer blocks.
4. **Long-term solution** — Agent execution belongs to an **async runtime / orchestrator off the
   main channel**, not to a command running inline. The command is a stand-in dispatcher until that
   runtime exists — the same open question as `platform-home.md` ("where does the runtime live?").
5. **Preventative** — Principle: **commands and lifecycle hooks observe and dispatch; they do not
   run agents inline.** Agents dispatched from the main channel run in the **background by default**.
   Recorded in the Investigator definition (`governance/agents/investigator.md`).

## Lesson

The incident log caught its **first design issue by being used** — exactly its job. And it confirms
the instinct stated minutes earlier: *take the work off the main channel.* An agent that runs inline
isn't "contained" enough — *contained* must also mean *off-thread*, or it holds the conversation
hostage. Synchronous dispatch was the gap; background dispatch is the floor; a real async runtime is
the ceiling.
