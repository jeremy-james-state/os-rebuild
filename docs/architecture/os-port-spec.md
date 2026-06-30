# OS → Harness Port Spec — the complete read

Two read passes are done (build→ship core, then the deeper deps). Below is every OS module worth
porting, mapped to a harness **component** (type · contract · wiring), in dependency order, with a
recommended sequencing. Philosophy unchanged: **port as proper components (registry row + contract,
wired under the orchestrator), one reviewed unit, spine frozen.**

## What the deeper pass changed

1. **`model.mjs` is NOT a runtime adapter** — it's the **Work Model (W1–W8)**: the work-unit schema
   the harness's `work.db` never had. Closed sets (operations, kinds, phases, dep-kinds), the
   difficulty-floor scoring formula, derived parent completion, non-linear phase transitions,
   surfacing/dormancy, cycle detection, cascade-drop, settled-decision logging. **This is the single
   most valuable port** — it's the schema the orchestrator/scheduler needs to sequence work, and it's
   pure + testable. It supplies the "atomic-step contract" and the `dependsOn` graph the redesign's
   scheduler was going to need anyway.
2. **The discernment gate (`discernment.mjs`) IS the harness's auto-mode classifier, generalised.**
   It's the same P1/P2/P3 logic the harness already enforces via the UserPromptSubmit hook, but as a
   **pure, deterministic, tested function** with a regex catalogue. Port it as the canonical gate
   library; the hook calls it instead of hard-coding rules.
3. **`deploy.mjs` (deployCheck) is the missing "deploy" stage gate** — the right-side gap in the
   recovery map. "You cannot turn on the unmeasured": missing viability/clarity score blocks deploy.

## The port table (dependency order)

| # | OS module | → Harness component | type | reads → writes | wiring (fires when) |
|---|---|---|---|---|---|
| 1 | `local-tracker/discernment.mjs` | `harness/lib/discernment` | **library** | — | imported by the auto-mode hook + builder + deployer |
| 2 | `local-tracker/model.mjs` (Work Model W1–W8) | `harness/lib/work-model` | **library** | — | imported by work store, scheduler, scoper |
| 3 | `local-tracker/deploy.mjs` (deployCheck) | `harness/lib/deploy-gate` | **library** | — | imported by deployer + the deploy command |
| 4 | `build-templates/build-templates.mjs` | `harness/lib/build-templates` | **library** | — | imported by executor |
| 5 | `scoper/{scoper,scope-schema,scope-extractor,trace,classify}.mjs` | `harness/agents/scoper` | **runner (agent)** | endstate → `record/scopes` | dispatched by orchestrator after clarifier |
| 6 | `executor/executor.mjs` | `harness/runners/executor` | **runner** | step+worktree → files | called by builder per step |
| 7 | `provisioner/provisioner.mjs` | `harness/runners/provisioner` | **runner** | plan → worktree | called by builder at build start |
| 8 | `builder/builder.mjs` | `harness/orchestrators/builder` | **orchestrator** | plan → built artifact | dispatched by scheduler at `build` stage |
| 9 | `deployer/deployer.mjs` | `harness/runners/deployer` | **runner** | artifact+readiness → deploy result | dispatched by scheduler at `deploy` stage |

(Modules 1–4 are pure libraries — zero IO, fully testable — so they port first and de-risk everything
above them. 5–9 are the pipeline, wired under the orchestrator.)

## Key invariants the OS already enforces (port them intact)

- **Injected hooks for every irreversible op** — builder/deployer cores are *pure gate logic*; the
  actual provision/execute/deploy/rollback are passed in as `hooks`. The core never touches the world.
  This is exactly the harness's "core stays pure, side-effects at the edge" rule. **Keep the seam.**
- **Fail-closed verdicts** — `uncertainScope` / `uncertainEndState`: never fabricate a commitment when
  the model output is unusable. Empty scope, flagged, returned. (= the closed-loop "unknown" outcome.)
- **Deterministic-after-inference** — model *proposes* (scope-extractor, executor's model path),
  deterministic checks *verify* (scope-schema validate, viability ≥0.95, trace every in-item).
- **`safeWrite` confines writes to the worktree** — the executor cannot write outside its sandbox.
  Maps onto the harness write-fence/write-zones; the worktree is the per-run write-path.
- **Worktree OUTSIDE the FUSE mount** (`WORKTREE_BASE`) — grounded fix: worktrees fail on the mount.
- **Failure ladder**: retry×2 → reframe → escalate (builder `executeWithRecovery`). Bounded, then
  it returns to the owner — never an infinite loop, never a silent give-up.
- **`stripFences`** — strip ```` ```lang ```` fences from model output before writing. Small, load-bearing.
- **Determinism invariant on templates** — same key + same params → byte-identical (no Date/random).

## How this fills the recovery-map gaps

The recovery map listed the right-side stages as **MISSING**. The OS port supplies exactly them:

| Recovery-map gap | Filled by |
|---|---|
| **build** (was "proposed") | builder + executor + provisioner + build-templates (#4,6,7,8) |
| **deploy** (MISSING) | deployer + deploy-gate (#3,9) |
| scope (was "template only") | scoper (#5) — a real agent, not just a template |
| the **scheduler** (the orchestrator) | builder is the *build-stage* orchestrator; the top scheduler still gets built in redesign Stage 4, and now has the Work Model (#2) to sequence against |
| **runtime adapter** (clarifier/planner need it) | still needed — the OS `claude -p` call lives inside `executor.modelProduce`; lift it into a shared `harness/lib/model-runtime` so clarifier/planner/scoper/executor all share one adapter |

> Note: the OS `executor.modelProduce` (claude -p + retry/backoff + EXECUTOR_STUB) **is** the runtime
> adapter the harness's clarifier/planner are missing. Extract it as `harness/lib/model-runtime` (a
> 10th component) so it's shared, not buried in the executor.

## Recommended sequencing (one reviewed unit, but staged internally)

**Stage A — the pure libraries (zero risk, all testable, no wiring):**
port #1 discernment, #2 work-model, #3 deploy-gate, #4 build-templates, +10 model-runtime as
`harness/lib/*` with a `contract.json` each and a test each. These stand alone; nothing depends on the
orchestrator. **This alone is high value** — the Work Model upgrades `work.db`, and discernment becomes
the canonical gate. Recommend doing this first and reviewing it before touching the pipeline.

**Stage B — the build→ship pipeline (wired under the orchestrator):**
port #5 scoper, #6 executor, #7 provisioner, #8 builder, #9 deployer as proper components, with the
injected-hooks seam intact, dispatched by the scheduler at the scope/build/deploy stages. This is the
net-new firing behaviour — gate it behind the verification stage, exactly as redesign Stage 4 says.

## The one open call for you

The OS pipeline assumes **worktrees + an integration trunk + sandboxes** (from README-START). The
harness today uses **branch-per-run + write-zones**, not worktrees. Two options for the build pipeline:

- **(A) Port the worktree model** (provisioner creates `.worktrees/<run>` outside the FUSE mount) —
  truest to the OS, gives real isolation for parallel builds, but adds the worktree machinery.
- **(B) Map onto branch-per-run** (the build runs on the run's branch; write-zones are the sandbox) —
  lighter, reuses what's already enforced, but serialises builds that the worktree model could parallelise.

Per the concurrency policy ("disjoint write-paths may run in parallel; overlapping serialise"), **(B)
is the lighter default and matches the harness's existing spine**; **(A)** only earns its place once
parallel interdependent builds are real — which, per the same policy, for coupled code they deliberately
aren't yet. **Recommend (B) now, (A) deferred** unless you want parallel-build isolation from day one.
