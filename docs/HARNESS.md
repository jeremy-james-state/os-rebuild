# What the harness does — in plain language

The **harness** is the always-on core of this OS. Its one job: **see every message before
the assistant does, decide what should happen, do the deterministic part itself, and write
down what happened** — so nothing depends on the assistant remembering to behave.

## The loop, step by step

Every time you send a message, before the model sees anything:

1. **Extract** — your message becomes a *signal*: a numbered, durable row in the record
   (`record/signals.jsonl`). If that write fails, the turn says so loudly — a signal is
   never silently dropped.
2. **Classify** — a deterministic rule-set decides what KIND of ask this is (a health
   check? an incident? a build request?) and which worker should own it. When it doesn't
   know, it says `unknown` — it never invents a target.
3. **Estimate** — a fixed rubric scores the work (value, readiness, effort) so routing
   decisions are comparable over time.
4. **Route & execute** — the orchestrator dispatches ONLY to workers that really exist.
   Today one handler is live: the **doctor** (the drift check). An explicit command like
   `os: check the harness for drift` is ENFORCED: the harness runs the doctor for real,
   answers you directly, and the model never runs. Anything else is STEERED: the model
   answers, but with the loop's verdict injected as its operating orders.
5. **Trace & record** — every hop carries one trace id, and the outcome lands in
   `record/runs.jsonl` stamped with the OS version that produced it. That's the
   `🔁 OS loop …` line you see on every message and in the status bar.

## The guards

Two fences run before every tool call: **confinement** (writes outside this repo are
blocked — fail-closed; reads of sibling projects are blocked too) and **harness-lock**
(two writers can't edit the same component at once; the spine manifest locks as a unit).

## What makes it trustworthy

- **It boots sealed.** Sessions run the harness from a read-only, versioned snapshot
  (`.system/releases/current`), not from whatever is half-edited in the workbench. A boot
  banner (`🖥 OS v1.0 booted…`) proves it every session; a broken snapshot refuses loudly.
- **Nothing fails silently.** Failed writes leave drop records; a reconciler sweeps for
  signals with no outcome and raises incidents; checks that can't run fail RED, not green.
- **It governs itself.** Any code change without a version bump, any census row that
  disagrees with reality, any rogue folder — the doctor/structure checks go red and the
  merge gate refuses. This whole migration was executed under those controls, and they
  fired on their own builder repeatedly.

## Where to look

`harness/loop/LOOP.md` (technical map) · [`OS-CONTENTS.md`](OS-CONTENTS.md) (what ships) ·
`governance/procedures/` (release · workbench · testflight · versioning) · every app carries
its own plain-language README (`apps/`, `apps/_drafts/`).
