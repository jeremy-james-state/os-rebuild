# os-rebuild — the Harness foundation, wired and watchable

A rebuild of the [OS v2 capstone](https://github.com/jeremy-james-state/OS) into a clean
repo, focused on a **foundation you can trust**: three bounded layers, a signal loop that is
*actually wired, running, and tested*, a *readable* data layer, and two guarantees you can
watch hold — **nothing fails silently** and **no agent is referenced that isn't really there**.

## Watch it work

In a session opened here, type a command — the loop runs and prints its trace:

```
🔁 OS loop  signal extracted (#7)  ·  classified → check (high) → doctor  ·
            estimated 61 (medium)  ·  routed → doctor  ·  outcome: completed
```

Or run it directly:
```sh
node harness/loop/orchestrator/index.mjs --demo "check the harness for drift"
printf '{"prompt":"the deploy failed"}' | node harness/loop/session-feedback/index.mjs
```

## The three layers (the boundary is the point)

> A thing can only be governed if it has a clear boundary. The three layers are kept
> physically separate, each with its own overview.

| Layer | Where | What | Overview |
|---|---|---|---|
| **governance** — the law + its enforcement | `governance/` | rules, decisions, permissions, candidates, and the checks that bite | [`governance/README.md`](governance/README.md) |
| **execution** — the running instance | `harness/` | the loop (components by type under `sandbox/`), the manifest/registry | [`harness/loop/LOOP.md`](harness/loop/LOOP.md) |
| **data** — append-only truth + readable view | `record/` → `state/os.db` | JSONL logs (signals, runs, classified, estimates, incidents) projected into a readable SQLite table | [`record/README.md`](record/README.md) |

The boundary itself: [`docs/BOUNDARY.md`](docs/BOUNDARY.md) · the constitution:
[`docs/HARNESS-CHARTER.md`](docs/HARNESS-CHARTER.md).

## The signal loop

```
extract → classify → estimate → route → outcome (completed | unknown | failed)
                                                      └─ reconciler raises any limbo
```

Full map + pieces: [`harness/loop/LOOP.md`](harness/loop/LOOP.md). Every hop is one
span on one **trace**; every row carries the four-tuple `session · run · call · branch` and
lands in the readable `state/os.db`.

**Two guarantees, enforced and demonstrated:**
- **Nothing fails silently** — every signal ends in a terminal outcome; the `reconciler`
  raises any that don't.
- **No ghost agents** — the dispatcher routes only to real handlers; an unknown target is an
  explicit `unknown`, and `governance/checks/no-ghost-agent.mjs` fails the build if any
  routing target resolves to nothing real.

## Check it (the gate)

```sh
node governance/checks/doctor.mjs            # harness drift-check (fail-closed)
node governance/checks/governance-check.mjs  # self-governance + ledger integrity
node governance/checks/structure-check.mjs   # top-level schema
node governance/checks/no-ghost-agent.mjs    # every routing target is real
node --test harness/sandbox/**/**.test.mjs governance/checks/*.test.mjs
node harness/loop/loop-store/index.mjs project && sqlite3 state/os.db \
  'select stream,n,status,summary from events order by ts;'   # read the data layer
```

## How it grows (build to Green, you admit)

Everything in `harness/sandbox/` is a **candidate** built to **Green** (code + contract +
tests, all checks clean), registered in [`governance/candidates.md`](governance/candidates.md).
A session may take a candidate to Green; **admission into the harness file is a human step**
([`governance/rules/harness-admission.md`](governance/rules/harness-admission.md)). Nothing
self-promotes — that is what stops the creep.

## Status

- **Tier A — foundation + live loop:** ✅ built, 70/70 tests, all checks green, wired + demonstrated.
- **Tier B — observable web view (Vercel + Supabase):** in progress.
- **Tier C — real agents + gated chain:** next.
