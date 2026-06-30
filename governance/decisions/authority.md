# Decision: The Authority Model

> Who can do what, how authority is requested and granted, and how approvals reach
> the human. **Defined before wiring.** Normative. Answers the seven questions.

## Capability — what a component can do

A component's authority = its **contract** (`writes`/`reads`/`triggers`) ∩
**write-zones** ∩ **`permissions.json`** (allow/deny). **Default-deny** outside it.
The **write-fence** enforces it at runtime; it physically cannot act outside its set.

## Requesting authority

A component emits a **`request:authority` signal** → the **router** carries it to the
governance lane. A request is a *traced signal*, never a side-channel.

## Granting authority

A grant = a **governance change** (edit `permissions.json` / write-zones) through the
pipeline: `propose → decide → apply → log`.

## Deciding (who decides, and how)

**Confidence/severity routing:**
- reversible + low-stakes + high-confidence → granted **by rule** (auto), logged.
- irreversible / high-stakes / low-confidence → **escalated to the human**.

The decision basis is recorded — never an unexplained yes/no.

## Approvals

- **Where they sit:** the `decide` gate — the approval-runner + the **governance ledger** (`record/`).
- **Traceability:** every approval = a ledger row (`who · when · what · basis · decision`) + the four-tuple.
- **How they reach you:** on escalation, a **traced decision surface** (modal /
  AskUserQuestion). The **reconciler** guarantees no request is silently dropped.

## Hierarchy

- **`ov` (Overseer)** — standing authority over the work graph, gate truth, status.
- **Jeremy (human governor)** — final authority on high-stakes/irreversible + taste.
- **Agents** — only their *declared* capability; everything else is requested + granted.

## Status

- **Defined:** this decision.
- **Enforced:** Stage 2/3 — the write-fence, the approval-runner, router escalation.
  **Not wired yet, by decision** (define before build).
