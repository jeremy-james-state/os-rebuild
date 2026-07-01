# Decision: The Two Enforcement Points (what the harness *is*)

> Strip away substrate — cloud, DB files, deploy infra, runner code — and the harness
> reduces to a set of **rules** and the **two points where those rules are enforced**.
> This decision names them. Normative. Builds on [`component-model.md`](component-model.md),
> [`data-layer.md`](data-layer.md), [`write-zones.md`](write-zones.md).

## The reduction

**harness = governance + its two enforcement points.** The rules are the contracts in
`governance/`, written once and rarely touched. They bite in exactly two places — one per
plane:

| Gate | Plane | Decides | When it bites |
|---|---|---|---|
| **#1 — the commit gate** | control plane (code / definition) | what is allowed into the pinned checkout | on merge (`doctor`-green) |
| **#2 — the write hooks** | execution plane (data) | which store / agent may write which table in `state/os.db` | at the moment of write |

Code is gated **on the way in** (merge); data is gated **at the moment of write** (hook).
Same rules, two bite-points. **Admission folds into #1** — admitting a candidate *is* a gated
manifest merge, not a third gate.

## Gate #1 — the commit gate  (BUILT)

`doctor`-green + a human merge decide what enters the pinned checkout. Implemented:
[`../enforcement/doctor.mjs`](../checks/doctor.mjs) (drift / registration, **merge-blocking**)
and [`../enforcement/governance-check.mjs`](../checks/governance-check.mjs) (self-governance,
ledger integrity, declared workflows, one-owner-per-write-zone), run in
[`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) (**active** — runs on every
PR/push to main). This gate's logic (doctor + governance-check + structure-check + tests) also runs
locally.

## Gate #2 — the write hooks  (SPECIFIED, NOT BUILT)

The sole-writer rule ([`data-layer.md`](data-layer.md): one store owns one table and is its only
writer) must be enforced **at write time** against `state/os.db` tables. Today only the
*declaration* exists: `governance/permissions.json` names one owner per write-zone and
`governance-check` flags conflicts — but that check is **static, at the gate, over filesystem
paths**, not a runtime hook over `os.db` tables. **The runtime table-scoped write hook does not
exist yet.** Building it is the missing half of the harness:

1. **Extend write-zones from filesystem *paths* → `os.db` *tables*** — a contract / `permissions.json`
   names a table's sole writer; the gate validates it.
2. **Add the runtime hook** — every store write passes a table-scoped authorization check
   (*is this agent the sole writer of this table?*), defense-in-depth atop the gate-time
   declaration.

Until #2 is built, table integrity rests on the gate-time declaration + sole-writer discipline,
not on a runtime stop. The next data-layer stores (`run-store`, `work-store`) are where it lands.

## Corollary — harness vs substrate

Everything the gates operate *on* is **substrate**, not the harness: `harness/runners/` (the
executing code), `state/` (projections), `record/` (truth). Their READMEs already say so
(`state/README`, `record/README`: *"Not the harness"*). A folder with no governance and no hooks
would still fire agents and write data — it just wouldn't be a harness, it'd be a script. **The
harness is specifically the layer that stops an agent doing what it isn't permitted to do** — the
governance, plus the two points where it bites.

## Status

- **Gate #1:** built, merge-blocking.
- **Gate #2:** specified here; the runtime hook is unbuilt; it lands with the data-layer stores.
- **Governable** ([`governability.md`](governability.md)): **Bound** (two named gates), **Observable**
  (the CI result + the write-hook's own signal), **Triggerable** (merge / write), **Clear Exit**
  (allowed / denied), **Tested** (doctor + governance-check tests today; gate #2's tests land with it).
