# Loop optimisation roadmap — beyond more handlers

> **Status:** ROADMAP, ranked by leverage. 2026-07-02. Nothing here is scheduled; each
> item ships the house way — RED-first evals in the battery, one release, evidence
> ([workbench.md](../../governance/procedures/workbench.md)). Baseline design claims:
> [docs/ORCHESTRATOR.md](../ORCHESTRATOR.md).

## Ranked opportunities

### 1. Close the feedback loop — calibration from the record
The loop writes classification + estimate + outcome for every signal but never reads them
back. Build a deterministic **calibration pass** over `record/`: score the classifier
against realized outcomes (misroute rate, unknown rate by intent, confidence calibration).
The live record already shows the gap it would quantify: build/question-intent signals
routinely land `unknown` (#108, #111–#113). Rule-tuning becomes evidence-driven; the
report itself becomes a check ("classifier quality below floor → WARN").
*Why first:* it multiplies the value of every future change by making routing quality
measurable — the most agentic-loop-native upgrade available.

### 2. Sub-signal decomposition
One prompt often carries several intents (this session's messages did, consistently). A
`decomposer` (already a planned census row) splits a signal into child signals with
linked traces → per-intent terminal outcomes instead of one coarse verdict. Multiplies
every existing and future handler.

### 3. Resource accounting
The architecture review's declared #1 completeness gap: meter turns / tool calls / wall
time per signal, stamp cost onto run rows, feed the estimator empirical effort. Enables
budget-aware routing later; makes the OS's "manages scarce resources" definition true.

### 4. Doctor off the hot path (incremental checking)
Check-classified prompts spawn a full doctor synchronously (~1s of prompt latency on the
enforced path). Cache the verdict against a content hash of the manifest + checked
surfaces; invalidate on change; mark freshness honestly in the trace ("doctor: cached,
verified <n> turns ago"). Same guarantee, instant turn.

### 5. Estimator → scheduler
Scores are recorded; nothing queues. A durable backlog stream ordered by `rank()`, swept
on the reconciler's tick, turns the loop from purely reactive into one that manages
deferred work.

### 6. Loop-level handler policy (middleware)
Generalize the doctor handler's hang/fabrication guards into uniform, once-tested policy
for every handler: timeout, recorded-retry, circuit-breaker. Written at the loop, not
per app.

## Consciously rejected (for now)

- **Resident daemon** (avoid per-turn node spawns): trades the loop's provability and
  crash-simplicity for ~100ms. The per-turn process IS the reliability model.
- **LLM-in-the-loop routing** beyond an *advisory* fallback for `unknown` (recorded as
  steered, never enforced): the deterministic spine is the product.

## Deferred pending human review

- **The OS update mechanism** ([2026-07-02-os-update-mechanism-design.md](2026-07-02-os-update-mechanism-design.md))
  — designed, merged, explicitly **awaiting Jeremy's review before any build**.
