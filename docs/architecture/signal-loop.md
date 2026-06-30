# The Signal Loop — placement & roadmap

> Descriptive. Where the `signal-ledger` candidate sits in the harness, where it is heading,
> and the discipline that keeps it from sprawling. Normative substrate it conforms to:
> [`../../governance/decisions/data-layer.md`](../../governance/decisions/data-layer.md).
> Admission gate: [`../../governance/rules/harness-admission.md`](../../governance/rules/harness-admission.md).

## Where we are

We have proven the first move: **every input is extracted into a four-tuple-stamped signal**,
landed in the truth log, projected, synced to a hosted store, and made visible — hands-off.
That is the *capture* half of the **signal extractor**. It is real, but it is a **candidate**
in `harness/sandbox/signal-ledger/` — not admitted, not in the harness file.

## Its home (when admitted)

Nothing here invents a new tier. The home was **already declared** in `data-layer.md`:

| Candidate piece (`harness/sandbox/signal-ledger/`) | Declared home in the data layer |
|---|---|
| `intake.mjs` + `filter.mjs` (capture real inputs) | the **signal extractor** (door → signal) |
| `record/signals.jsonl` | the **`signals` store** — append-only truth, sole-writer |
| `ledger.mjs` rebuild → `state/os.db` | a **`state/` projection** (rebuildable) |
| `sync.mjs` → Supabase `os_signals` | a **hosted projection** — a peer of `state/os.db`, *inside the data layer* |
| `persist.mjs` (auto commit+push) | wiring (how the truth log persists), not a store |

So the placement question has a clean answer: **`signal-ledger` is the data layer's signal
store + extractor; Supabase is a hosted projection within the data layer.** Admission moves the
code from `sandbox/` into its data-layer home and declares it in the harness file — one step,
human-gated.

## Received vs sent

Today we capture **received** only (inbound `UserPromptSubmit`, `phase: received`). The
**sent** side — what the harness/agent did in response — is not yet captured, and we will likely
want it for context and for closing the loop.

- **Plan (not built):** capture the assistant's response as an **outbound signal** via the `Stop`
  hook, linked to the received signal by the same `run`. Same model — every hop is a signal —
  so it adds a `source`, not a new mechanism.
- This keeps the four-tuple's promise: a received signal and its sent counterpart share
  `session · run`, so the exchange is one traceable unit.

## Roadmap — extract → classify → route → act

The interesting part ("do something with it") is the rest of the closed loop from `data-layer.md`:
`extractor → classifier → router → completed | unknown | failed`, with a reconciler. **This is a
big piece of work, and the rule is: one stage at a time, each its own candidate, each separately
admitted.** No big-bang.

| Stage | What | Status |
|---|---|---|
| **Extract** | door → four-tuple signal (capture real inputs) | ✅ candidate, green |
| **Classify** | tag a signal (type/intent) — the signal extractor's routing tags | ⬜ next candidate |
| **Route** | dispatch a classified signal to a handler; record a terminal outcome | ⬜ later candidate |
| **Act** | the handler does the work; outcome closes the loop | ⬜ later candidate |
| **Reconcile** | sweep for signals with no terminal outcome; raise an incident | ⬜ later candidate |

## Governance guardrails (the anti-sprawl contract)

The whole reason this is documented before it is built:

1. **Stays a candidate** in `harness/sandbox/` until a human admits it (`harness-admission.md`).
2. **The home is pre-declared** (the data layer) — we fill a named slot, we do not add tiers.
3. **One stage = one candidate = one admission.** Classify, route, act each land separately,
   reviewed on their own. We never merge a half-built loop into the harness.
4. **The harness file (`manifest.json`) is touched only at admission**, never by capture or wiring.
5. **No new top-level folders.** Every piece lives under an existing tier (`harness/`, `record/`,
   `state/`, `docs/`, `governance/`, `.github/`, `.claude/`).

The discipline *is* the deliverable here: we expand the loop only along a path that stays
observable, contracted, green, and gated — so we get the capability without the v1 sprawl.

## Capture is local-only; the Data-Layer transport is deferred

Per main's record/ policy (PR #23) — **runtime streams are gitignored; their durable home is the
Data Layer** — `record/signals.jsonl` is gitignored. The capture hook (`intake.mjs`) does a single
thing: **append the signal locally.** No commit, no push, no Supabase sync, every turn.

Earlier (gov-029) this candidate kept `signals.jsonl` *tracked* and used `git push → CI → Supabase`
as a transport, because the container can't reach Supabase directly. That **caused repo-wide churn**
once the auto-commit hook reached main (a commit + push on every turn, in every session, polluting
branches/PRs). So it was **retired (gov-031)**: the divergence is ended, the auto-commit removed,
and `signals.jsonl` re-gitignored to match main.

**Consequence:** signals are captured locally and are projectable into `state/os.db` + the viewer,
but **reaching the Data Layer (Supabase) is deferred** until the Data Layer is formed with a real
transport (direct ingest from a formed store — not git-as-courier). `sync.mjs` + the
`sync-signals.yml` workflow remain as **dormant** references for that future work.
