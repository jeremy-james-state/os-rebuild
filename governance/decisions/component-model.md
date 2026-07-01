# Decision: The Component Model (the governing structure)

> The definition every running component conforms to. **Locked before wiring** — the
> v1 lesson was that defining *after* building led to ungovernable sprawl. Normative.
> Descriptive reference: `docs/architecture/harness-architecture.md`.

## What a component is

A **registered, contracted unit of executing code** in `harness/` — never a loose
script. Concretely: a script (entry module) **+ a registry row + a co-located
contract**. If code in `harness/` is fired or imported but **not registered +
contracted**, the `doctor` flags it **RED**. (Dead/undeclared code cannot hide.)

> **Harness vs substrate (the sharpening).** The *executing code* is **substrate**; what makes
> it a governed component — and part of the **harness** — is the **contract + registry row + the
> enforcement that binds them**. Strip the governance away and the code still runs; it just isn't
> a harness, it's a script. So `harness/runners/<x>/index.mjs` is substrate the harness operates
> *on*; the harness proper is the contract over it and the two gates that enforce it (the commit
> gate + the table-scoped write hooks — see [`enforcement-points.md`](enforcement-points.md)).

## The mandatory parts

1. **Type folder** — it lives by its type: `harness/{orchestrators,runners,services,hooks,lib}/`.
2. **Entry** — `index.mjs` (or `.py`/`.sh` only at the OS/git boundary).
3. **Contract** — co-located `contract.json`: `input`/`output`/`exit` + `reads`/`writes` + `triggers` + `config`. **Mandatory** — the doctor requires it.
4. **Registry row** — in `registry.json`: id, type, status, state, contract pointer, health.

## Metadata (declared/derived — not folders)

- **type**: `orchestrator | runner | service | hook | library` (= the folder).
- **role** (derived from schema): `agent | command | query | store`.
- **status**: `wired | in-formation`. Neither ⇒ **RED**.
- **state** (promotion): `production | staging | candidate | sandbox | planned | quarantined | retired`.
  Two of these are pre-admission (live under `harness/sandbox/`, not yet in the harness file):
  **`sandbox` = a genuine experiment**; **`candidate` = built + proven, awaiting human admission**.
- **frozen**: bool — the safety spine; protected by CODEOWNERS + doctor, **a property, not a folder**.

## Invariants (the doctor enforces when wired)

- Every non-planned component has a co-located **contract**.
- No dead/undeclared executing code in `harness/` (registered, or RED).
- **Sole-writer**: one store owns one table.
- Production never depends on `sandbox`/`quarantined`/`planned`.
- The **frozen** spine changes only via the highest-rigor path.

## Lifecycle

`candidate → proposed → staged → testing → approved → active → deprecated`, promoted
via the chain + human approval, recorded in `record/governance-ledger.jsonl`.

## Status of the model itself

- **Defined:** this decision.
- **Enforced (in progress):** type-folders are populated (done); `manifest.json` → `registry.json`
  split is **done** (rows live in `registry.json`, merged by the doctor — see
  [`manifest-registry.md`](manifest-registry.md)). **Remaining:** the doctor *requiring* a co-located
  `contract.json` — deferred until components leave `state: planned`.
- **Note:** the `router` was wired **ahead of this model** (registered, no contract
  yet). That was a step ahead of the rails; it is **reconciled to this definition**
  when enforcement is built — it is not "in" the governed harness until it conforms.
