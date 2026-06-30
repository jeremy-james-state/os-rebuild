# Decision: Platform home — GitHub's role vs the runtime/Data-Layer home

> **Status: OPEN (question captured, decision deferred).** This records a question and the evidence
> behind it so it isn't lost; it does **not** settle the runtime home yet. Revisit when *forming the
> Data Layer* — that work and this decision are the same question. Owner: `jeremy`.

## The question

Is **GitHub** the long-term home for the whole harness — or only part of it?

## The framing — GitHub's roles split in two

| GitHub is **excellent** at this (likely permanent home) | GitHub **strains** at this (likely moves) |
|---|---|
| versioned **truth** — ledger, decisions, agent definitions, code | a **runtime data store** |
| the **merge gate** — required CI checks = deterministic law | **real-time / live state** |
| **branch protection / rulesets** — platform-level governance | **low-latency execution + network** |
| **identity** — the GitHub App as the harness's write-identity | **multi-actor concurrency coordination** |

## The evidence (from the 2026-06-30 session)

Every pain was GitHub being asked to be a **runtime/data layer**; every smooth thing was GitHub
being a **governance backbone**:

- **Pain (runtime):** the auto-commit churn (git-as-transport); the #24 squash dropping a layer
  amid concurrent merges; runtime streams having to be gitignored (`record/*.jsonl`); the container
  **cannot reach Supabase directly** (so the only path to the Data Layer is CI); concurrent sessions
  clobbering each other with no coordination.
- **Smooth (governance):** the governance ledger; the `doctor` merge gate (required, deterministic);
  PR review; the App identity; branch-protection rulesets.

## Tentative direction (not yet decided)

- **GitHub stays** the home for the **law, the record-of-truth, and the gate** — versioned,
  reviewed, required-checked, identity-bound. This is its strength and there's little reason to move it.
- **The runtime + Data Layer want their own home** — a compute environment with a real database
  and network — connected to GitHub, not hosted by it. Signals, projections, live state, and agent
  execution live there.

So the likely shape is **not "GitHub or X"** but **"GitHub for governance + a runtime home for
execution/data, joined."** Answering *"where does the runtime live?"* is essentially *forming the
Data Layer*.

## Open sub-questions (for when we decide)

1. Which runtime/data platform (Supabase + which compute? something else)?
2. How do the governance plane (GitHub) and the runtime plane connect — who writes back to git, and
   how does the merge gate still bind runtime actions?
3. Does the harness's **execution** move off CI entirely, or stay CI-triggered with the DB elsewhere?

## Why this is `OPEN`, not decided

Deciding the runtime home commits infrastructure and shapes everything downstream. Per the v2 ethos
(define before build) we record the question + evidence now, and decide deliberately when we form
the Data Layer — not reactively. (Related: [`data-layer.md`](data-layer.md),
[`identity.md`](identity.md), [`../../docs/architecture/signal-loop.md`](../../docs/architecture/signal-loop.md).)
