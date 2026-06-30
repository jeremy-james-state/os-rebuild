# Rule: CI Workflows are Governed Controls

> A GitHub Actions workflow runs code, can hold **secrets**, and can **egress data** — it is a
> control acting on the repo, not inert config. So a workflow does not arrive by being committed:
> it must be **declared, ledgered, and explicitly approved**. Owner: `ov`. Enforcement:
> `governance/enforcement/governance-check.mjs` (fail-closed at the merge gate) + CODEOWNERS on
> `.github/`. Registry: [`../environment.json`](../environment.json) (L3_repo.controls).

## Why

Approving a large PR is a blunt instrument — a powerful CI actor (a secret-holding, data-egressing
job) can ride in unnoticed. This rule makes every workflow a **conspicuous, owned** decision, the
same way the harness doctor makes every component declared.

## The rule

1. **Declared.** Every file in `.github/workflows/` MUST be declared in
   `governance/environment.json` under `layers.L3_repo.controls`, with: `id`, what it `does`,
   its `path`, the `secrets` it uses, and what it `egress`es. An undeclared workflow is **drift**.
2. **Ledgered.** Adding or materially changing a workflow requires a `record/governance-ledger.jsonl`
   entry stating purpose, triggers, secrets, and data egress.
3. **Approved.** The change is approved by the owner *as a workflow change* — called out, not buried
   in an unrelated PR. `.github/` is owner-reviewed (CODEOWNERS) and the main ruleset requires PR
   approval, so the gate exists; this rule makes the approval *informed*.

## Enforcement (teeth)

`governance-check` lists `.github/workflows/*` against the declared set in `environment.json` and
**fails the merge gate (ERROR)** on any undeclared workflow. Declared-but-absent is a WARN.

## Exit

A workflow is either **declared + ledgered + approved**, or it is **removed**. It does not run
ungoverned.
