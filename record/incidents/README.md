# record/incidents/ — the incident log (work-in-progress data layer, human form)

The durable, human-curated record of things that went wrong and how they were resolved.
Tracked markdown, one file per incident — the **interim** form of the data layer's `incidents`
stream while the Data Layer isn't yet formed and there's no orchestrator to route them automatically.

> **Why markdown, why now.** Routing a problem into the right place will eventually be the
> orchestrator/dispatcher's job (the extract → classify → route loop; see
> [`../../docs/architecture/signal-loop.md`](../../docs/architecture/signal-loop.md)). Until then we
> file incidents **by hand** — when something goes wrong, we say "that's an incident" and drop a
> file here. This gets governance and control running, with no agents loose and no sprawl. The
> machine `incidents` stream (gitignored jsonl → Data Layer, per `../SCHEMA.md`) is the automated
> form for later; this folder is the human form for now. (These markdown files **are** tracked —
> they're curated records, not runtime stream data.)

## The rule — an incident is done only when all five are present

(Brought forward from the archived method `frame-gate-local/method/incident-resolution.md`.)

1. **Root cause** — the confirmed cause, with evidence (not a guess).
2. **Recreated** — how to reproduce it.
3. **Immediate fix** — what stopped the bleeding now.
4. **Long-term solution** — the durable fix.
5. **Preventative** — so it cannot recur (a hook / guard / check / rule).

## How to file one

Copy [`_template.md`](_template.md) to `incident-YYYY-MM-DD-short-slug.md`, fill the five steps,
set `status` (`open` → `resolved`). An open incident with empty steps is fine — it's a placeholder
that says "this needs working through."

## Log

- [`incident-2026-06-30-auto-commit-hook-churn.md`](incident-2026-06-30-auto-commit-hook-churn.md) — resolved.
- [`incident-2026-06-30-incident-command-blocks-the-main-channel-synchronously.md`](incident-2026-06-30-incident-command-blocks-the-main-channel-synchronously.md) — resolved (the log's first self-caught design issue).
