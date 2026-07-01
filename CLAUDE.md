# os-rebuild — working notes for Claude

This repo is the rebuilt Harness foundation: three bounded layers (governance / execution /
data) and the wired **signal loop**. Orientation: [`README.md`](README.md) ·
[`harness/sandbox/LOOP.md`](harness/sandbox/LOOP.md) · candidates in
[`governance/candidates.md`](governance/candidates.md).

## The harness governs the turn — your operating protocol

A `UserPromptSubmit` hook (`harness/sandbox/session-feedback/index.mjs`, wired in
[`.claude/settings.json`](.claude/settings.json)) runs the **real** signal loop on every prompt
*before you see it* — classify → estimate → route → execute the routed handler → record — then
acts in one of two modes:

- **Explicit command (`os: …`)** that completes on a real handler at high confidence → the hook
  returns `decision:"block"` and the harness's result is shown to the user **without you running
  at all**. You will simply not see those turns. This path is *enforced*.
- **Everything else** → the hook injects a `[HARNESS]` block into your context containing the
  `🔁 OS loop` trace + this operating protocol. **When you see that block, follow it:**
  1. **Begin your reply with the `🔁 OS loop …` trace line verbatim**, on its own line, then a blank line.
  2. The loop already classified, routed, and ran any real handler this turn. **Report that
     outcome faithfully — do not re-run it, do not invent a different result.**
  3. Address the user's actual request **within the routed intent**; don't free-associate beyond it.

  If no `[HARNESS]` block is present, skip the trace line — never fabricate one.

**Honest boundary (do not overstate this):** the `os:`-command path is *enforced* (you are
bypassed). The natural-language path is *steered* — this protocol is context you should follow,
not a hard constraint. The `🔁` trace also renders in the status bar (`statusline.mjs`), which is
always-visible and deterministic.

## Ground rules for this repo

- Everything under `harness/sandbox/` is a **candidate** built to Green; admission into
  `harness/manifest.json` is a human step ([`governance/rules/harness-admission.md`](governance/rules/harness-admission.md)). Don't self-admit.
- The data layer (`record/*.jsonl`) is **append-only** — new streams/rows only, never rewrite
  `governance-ledger.jsonl` or existing `record/incidents|handoffs`.
- Keep the four checks green: `doctor`, `governance-check`, `structure-check`, `no-ghost-agent`.
