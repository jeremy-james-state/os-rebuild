# Rule: Doc Discipline

**Statement.** No document is created without a *type* and a *home*. Classify
before you write. If it fits no type, don't write a doc — capture it as the thing
it actually is (a decision, a rule, a definition).

## governance vs docs — the test

- **`governance/` = normative** — *what must or may be.* Something the harness, a
  gate, or the process **enforces or consults** to decide. The **authority**.
- **`docs/` = descriptive** — *what is / what things mean.* Something a human reads
  to **understand**. Informs, not authority.

Ask: *"Does something enforce or consult this to decide?"* → `governance/`. *"Is it
for a human to understand?"* → `docs/`. **If both** (the charter, the boundary): the
enforceable part lives in `governance/` or **code** (e.g. the boundary is enforced
by the `doctor`); `docs/` explains and points to it. **One authority, never two.**

Look-up: *what's required/allowed/enforced* → `governance/`; *how/why it works* → `docs/`.

## One home per type

| Type | Home |
|---|---|
| decision / ADR | `governance/decisions/` |
| rule / principle | `governance/rules/` (+ a short line in `docs/principles.md`) |
| definition / concept | `docs/definitions/` (the wiki) |
| durable human reference (few, named) | `docs/` — e.g. `BOUNDARY`, `HARNESS-CHARTER`, this workflow |
| evidence / record-of-an-event (a plan that ran, a handoff) | `record/` (append-only) |
| transient / working notes | not committed |

## Navigability

`docs/` carries a **pointer-only index** (`docs/README.md`) — a map, never a flat
dump. The root holds only `README.md`.

## Enforcement

- **Now:** human review against this rule + classify-before-write.
- **Later (the real fix):** the promotion engine extracts decisions / principles /
  judgement-bases from conversation automatically, classifies them with confidence,
  logs to `record/`, and proposes promotion to `governance/` for approval. This
  manual discipline is the **bridge** until that exists (see
  `docs/architecture/harness-lifecycle-and-knowledge.md`).

**Owner:** governance / `ov`.
**Basis:** decided 2026-06-30 (logged in `record/governance-ledger.jsonl`).
