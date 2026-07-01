# The orchestrator — how the loop is built, and why

> The design claims of `harness/loop/orchestrator/` stated plainly, each tied to the code
> and the eval that enforces it. Honest by construction: the last section lists what this
> loop deliberately does NOT do yet. Plain-language overview: [HARNESS.md](HARNESS.md).

## What it is

A **deterministic dispatcher for one signal at a time**:
`extract → classify → estimate → dispatch → terminal outcome`, every hop traced and
recorded. ~130 lines, zero dependencies, no model inside. That smallness is the design:
everything that must be *provable* lives here; everything that reasons lives in apps.

## The properties that make it best-in-class loop design

1. **Complete mediation.** Every prompt enters the loop before the model sees it
   (UserPromptSubmit → sealed session-feedback → `runLoop`). There is no side door: the
   `os:` path is enforced (model bypassed), everything else is steered with the loop's
   verdict injected. *Enforced by:* F1/F2 + the live 🔁 on this very message.
2. **Terminal outcomes — nothing dangles.** Every signal ends `completed | unknown |
   failed`, written to `record/runs.jsonl`. A handler exception becomes a recorded
   `failed`, never a crash or silence. *Enforced by:* orchestrator tests + O2 completeness.
3. **Honest unknowns — no ghost calls.** Dispatch only to the `HANDLERS` table; an
   unrecognised target becomes an explicit `unknown` (this message routed exactly so).
   Statically, no-ghost-agent proves every classifier target resolves to something real;
   at runtime the table is the only door. *Enforced by:* G5a/G5b + no-ghost in CI.
4. **Separation of powers.** The classifier says *what this is*, the estimator says *what
   it's worth*, the orchestrator *routes* — three pure, independently tested components.
   Swapping the classifier for an LLM changes nothing about dispatch guarantees.
5. **Never trust a subprocess's silence.** The doctor handler treats empty/unparseable
   output or a signal-kill as a THROWN failure — a crashed check can never fabricate a
   clean bill (this was a real bug class, killed at P1). *Enforced by:* C6, fault-injected.
6. **Durability before conversation.** The signal row is written FIRST; if that write is
   dropped, the loop says so in the visible trace and records an explicit failed run —
   the record, not the chat, is the source of truth. Writes go through a single-writer
   lock that never robs a live holder and fails closed with a durable drop record.
   *Enforced by:* X2a/X2b.
7. **End-to-end tracing.** One `traceId` per signal, one span per hop (parent-linked),
   plus session/run/call/branch and the OS + component versions stamped on every run row
   — a null version stamp is loud, never silent. *Enforced by:* O1a/O1b/O1c.
8. **Deterministic and testable by construction.** Every source of nondeterminism (ids,
   clock, handler table, record dir) is injectable; the whole loop replays exactly in
   tests. This is why 244 tests can gate every merge.
9. **Fail-open for availability, fail-closed for controls.** A loop error never wedges
   your turn (hooks exit 0); but guards, checks, verification and version mandates refuse
   loudly. That split — *availability over false authority, controls over convenience* —
   is the binding principle from the governance ledger.
10. **Out-of-process recovery.** The reconciler sweeps the record for signals with no
    terminal run and raises incidents — the nothing-fails-silently guarantee does not
    depend on the loop's own health. *Enforced by:* C5.
11. **It runs sealed.** The loop you're talking to booted from a read-only, versioned,
    cut-then-verified snapshot — the loop's own code is under the same version control it
    stamps onto every row. *Enforced by:* S0–S8 + the SessionStart banner.

## What it deliberately does NOT do yet (the honest roadmap)

- **One live handler** (`doctor`). The dispatch table is the extension point; each new
  deterministic app adds a row (the pipeline chain — clarifier→…→deployer — is planned
  userland, not loop complexity).
- **No multi-step plans, no retries/backoff, no parallel dispatch, no preemption.** One
  signal, one route, one terminal outcome. Deliberate: those belong above the kernel
  (workflow apps), not inside the thing that must stay provable.
- **No resource accounting** — the estimator scores but nothing meters turns/tokens yet;
  the architecture review lists this as the top completeness gap.
- **Estimator consults, nothing queues.** Scores are recorded for future scheduling;
  today routing is rule-direct.

The bar for changing any of this: RED-first evals in the battery before the feature, per
[the workbench procedure](../governance/procedures/workbench.md) — the same way every
property above earned its number.
