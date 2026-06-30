# Decision: The Governability Test

> The single test that decides whether a principle, rule, or component can be
> *governed* — and therefore whether it is allowed to be a rail in the harness. Fail
> this test and the thing is, at best, advice in `docs/`; it is not authority.
> Normative. This is the entry test behind every row in `governance/readiness.md`.

A thing is **governable** if and only if it is all five — **four declared, one
demonstrated**:

## 1. Bound — it has determined edges (what's in, out, pass, fail)

Expressed, in order of preference:
- **Condition** — a machine-evaluable predicate. Deterministic; the doctor checks it.
- **Judgement** — where a predicate can't capture it, an agent decides — but the
  judgement is itself **bound**: it must carry a **basis** (why it is allowed to
  decide) and **acceptance criteria** (what counts as pass). A judgement without
  basis + acceptance criteria is an *opinion*, not a bound — and fails this test.

This is *bound to be free* applied to decisions: judgement is allowed, but only
inside declared criteria. Free within the edge, never without one.

## 2. Observable — its evaluation is recorded

You can see that it ran, on what, and what it decided. It emits to `record/` with
the four-tuple (`session · run · call · branch`). If you can't see it happen, it
isn't governed — it's hoped-for.

## 3. Triggerable — a defined event fires it

There is a declared trigger — a signal, a hook, a gate (`triggers`). A rule that
nothing invokes is dormant, not enforced.

## 4. Clear Exit — it terminates in a declared outcome

It ends in `completed | unknown | failed` — never silently, never open. Declared in
`exit`. Every trigger reaches an exit, or the reconciler raises it.

## 5. Tested / Verified — its enforcement has been *demonstrated*

The first four are *declared*; this one is *proven*. A rule is not a rail until you
have **watched it bind** — both halves: it **rejects** the thing it forbids, *and* it
**allows** the legitimate case. Declaration is a claim; a passing test is evidence.

- A control with no test is `defined-only` — treat it as advice, not enforcement.
- The test must be **repeatable** (re-run it after any change to the control).
- Testing is the only way to catch enforcement that silently exempts the wrong actor
  — e.g. the no-new-branches ruleset *looked* active but let the admin-session through
  until tested; the gap was invisible until a branch push was actually attempted.

> Worked example (2026-06-30): `bootstrap-no-new-branches`. **Rejects** — a new branch
> push returns `GH013 … creations being restricted`. **Allows** — a direct commit to
> `main` still pushes. Both observed. Only now is it a rail.

## Why the first four *are* the contract, restated as an acceptance test

The four criteria are exactly the facets a `contract.json` already declares. The
governability test is the contract turned into a pass/fail check:

| Criterion | Contract field | Doctor's check (Stage 2) |
|---|---|---|
| **Bound** | `input` + condition / judgement(`basis`, `acceptance`) | predicate evaluates, or the judgement carries basis + criteria |
| **Observable** | `writes: record/…` | an outcome row is emitted with the four-tuple |
| **Triggerable** | `triggers` | ≥ 1 declared trigger |
| **Clear Exit** | `exit` | a terminal status is reachable |
| **Tested/Verified** | *(not a field — evidence)* | a repeatable test shows it rejects + allows |

So: **to make a principle governable, write its contract — then test it.** A principle that cannot
be given a contract passing all four is not yet a rail — it stays in `docs/` as
understanding, not in `governance/` or `harness/` as authority.

## Where it is used

- **Entry test for `governance/readiness.md`** — a control earns a row only when it
  passes all four; otherwise it is `defined-only ⛔` at best.
- **Admission test for the harness** — code becomes a component only with a contract
  that passes all four; undeclared/unbounded code is flagged **RED** by the doctor.

## Status

- **Defined:** this decision.
- **Enforced:** Stage 2 — the doctor validates every contract against these four
  criteria (the governability check). **Not wired yet, by decision** (define first).
