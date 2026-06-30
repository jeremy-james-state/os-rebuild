---
description: File or check an incident in record/incidents/ — dispatches the Investigator agent
argument-hint: [short title of what went wrong]   (or "check" to validate all incidents)
allowed-tools: Bash(node harness/sandbox/incident/incident.mjs:*), Bash(git log:*), Bash(git status:*), Task, Edit, Read
---

# /incident — file an incident via the Investigator, deterministically

You don't write the incident — the **Investigator agent** investigates and fills it. The 5-step
structure and the "done = all five present" rule are enforced by
`harness/sandbox/incident/incident.mjs` (the deterministic exit), not by anyone remembering. The
Investigator's law is [`governance/agents/investigator.md`](../../governance/agents/investigator.md).

## If `$ARGUMENTS` is empty or is "check"

1. `node harness/sandbox/incident/incident.mjs check all`
2. Report each incident's status + missing steps. A `resolved` incident with missing steps is
   **not done** (the command exits non-zero) — say so plainly.

## Otherwise (filing — `$ARGUMENTS` is the title)

1. **Scaffold deterministically** — run:
   `node harness/sandbox/incident/incident.mjs new "$ARGUMENTS"`
   This writes `record/incidents/incident-<date>-<slug>.md` (all five step sections, `status: open`).
   Note the path it prints. Do NOT hand-write the structure.

2. **Dispatch the Investigator — IN THE BACKGROUND, then return immediately.** Use the **Task tool
   with `run_in_background: true`** to spawn a bounded subagent whose brief is the Investigator
   definition (`governance/agents/investigator.md`). Pass it the incident title and the scaffolded
   file path. Its job — *what information best reduces uncertainty?* — is **self-contained**:
   - read the evidence itself (this conversation as relayed in the brief, `git log`/`git status`,
     `record/`, referenced files),
   - derive an **evidence-based root cause** (never a guess),
   - fill the five steps + Summary + Lesson; set `severity` / `related`,
   - set `status: resolved` **only** if all five are genuinely filled — otherwise leave `open`,
   - **self-verify:** run `node harness/sandbox/incident/incident.mjs check <file>`; if it flags
     RESOLVED BUT INCOMPLETE, fill the gap or drop to `open`,
   - **update the log index:** append its one line to `record/incidents/README.md`,
   - **report back ONE line:** `incident-<id>: <status> — <≤10-word summary>`.
   **Bound it:** it writes only within `record/incidents/` (its incident file + its log-index line);
   it does not fix the underlying problem, touch anything else, commit, or merge.

   **Do NOT wait for it.** As soon as it's dispatched, tell the user: *"Filed `<id>` (open) —
   Investigator working in the background; I'll relay its result when it's done,"* and **end the
   turn.** The investigation stays **off the main channel** (see
   `record/incidents/incident-2026-06-30-incident-command-blocks-the-main-channel-synchronously.md`).

3. **When it completes** (you're notified), just **relay its one-line result.** No chores — it
   already self-verified and updated the log. Only step in if it reports a failure.

## Rules

- The script owns **structure + completeness** (deterministic exit). The Investigator owns
  **content** (evidence-based). The human owns **the merge**.
- `record/incidents/*.md` is **append-style** — never delete a past incident; supersede with a new
  one if a diagnosis is later corrected.
- Never fabricate a root cause. Unconfirmed ⇒ `status: open` — that's the honest state, not a guess.
