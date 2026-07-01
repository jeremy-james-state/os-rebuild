# The checks — what each one does, in plain language

These five scripts are the harness's immune system. CI runs all of them on every pull
request; the doctor also runs live inside every `os: check…` command and inside every
sealed release before it can be booted. **Green means "reality matches what we declared";
red blocks the merge.**

## doctor (`doctor.mjs`) — "is the harness what it says it is?"

The deep drift check. It reads the spine manifest (`harness/manifest.json` — every
component, its path, state, version) and compares it against reality:

- every declared component actually exists on disk (and nothing undeclared is wired in)
- versions are honest: any code change since the last release tag without a version bump
  is an ERROR; every version has a changelog history entry
- the release pins agree with the census (bump something → you must re-cut the release)
- the generated docs (`manifest.md`, `index.md`, per-component changelogs) byte-match what
  the generator would produce — no hand-edited drift
- contracts validate against their schema (in `harness/` AND `apps/`)
- candidates in `apps/_drafts/` can't claim admitted states (no self-admission)

Exit 0 = clean (warnings allowed) · exit 1 = drift, fail-closed.
Run it: `node governance/checks/doctor.mjs` (or just say `os: check the harness for drift`).

## governance-check (`governance-check.mjs`) — "does the law hold?"

Audits the governance layer itself: the ledger (`record/governance-ledger.jsonl`) is valid
append-only JSONL with required keys; markdown cross-references point at files that exist;
declared write-zones match `permissions.json`; `architecture.json`'s version matches its
history; no merge-conflict markers survive in tracked files.

## structure-check (`structure-check.mjs`) — "is the top level canonical?"

The repo's shape: exactly the expected top-level directories (`harness, apps, skills,
governance, record, docs, state, web, .github, .claude, .system`) — a missing or rogue
top-level folder is an ERROR (fail-closed since the reshape). New tiers require a
human-approved schema decision.

## no-ghost-agent (`no-ghost-agent.mjs`) — "is every routing target real?"

It must be impossible to route to an agent that isn't there. Derives every target from the
live classifier rules + orchestrator dispatch table and proves each resolves to something
real (a handler, a contract, a census row, or a check). Hardened: if it cannot import
those surfaces, or derives ZERO targets, that is an ERROR — blindness never passes.

## schema-validate (`schema-validate.mjs`) — the shared validator

Not a gate itself: the minimal JSON-Schema engine the doctor uses to validate the manifest
and every `contract.json`. Kept dependency-free and tested on its own.

> Plain-language descriptions of the loop and guards: [`docs/HARNESS.md`](../../docs/HARNESS.md).
> Each loop/guard component also carries its own README next to its code.
