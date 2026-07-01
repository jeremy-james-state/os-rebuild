# os-rebuild — working notes for Claude

This repo is the rebuilt Harness foundation: three bounded layers (governance / execution /
data) and the wired **signal loop**. Orientation: [`README.md`](README.md) ·
[`harness/sandbox/LOOP.md`](harness/sandbox/LOOP.md) · candidates in
[`governance/candidates.md`](governance/candidates.md).

## Show the signal-loop trace in every reply

A `UserPromptSubmit` hook — `harness/sandbox/session-feedback/index.mjs`, wired in
[`.claude/settings.json`](.claude/settings.json) — runs the loop on each prompt and injects a
single line beginning `🔁 OS loop` into your context for that turn. (Hook stdout is
context-only by Claude Code design: the user does **not** see it unless you surface it.)

**Begin every response by printing that `🔁 OS loop …` line verbatim, on its own line,
followed by a blank line** — then answer normally. This is what lets the user watch a command
pass through **extract → classify → estimate → route → outcome** in the chat. If no such line
is present in your context this turn, simply skip it — never fabricate one.

The same trace also renders in the status bar (the `statusLine`,
`harness/sandbox/session-feedback/statusline.mjs`). Both are observability — neither gates,
blocks, nor alters your actual work on the user's request.

## Ground rules for this repo

- Everything under `harness/sandbox/` is a **candidate** built to Green; admission into
  `harness/manifest.json` is a human step ([`governance/rules/harness-admission.md`](governance/rules/harness-admission.md)). Don't self-admit.
- The data layer (`record/*.jsonl`) is **append-only** — new streams/rows only, never rewrite
  `governance-ledger.jsonl` or existing `record/incidents|handoffs`.
- Keep the four checks green: `doctor`, `governance-check`, `structure-check`, `no-ghost-agent`.
