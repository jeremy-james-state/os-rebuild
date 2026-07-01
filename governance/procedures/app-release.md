# Procedure: releasing an app — the stages

> Recommendation adopted: **no separate "alpha" vocabulary.** The census state machine
> already carries the lifecycle; inventing parallel labels (alpha/beta/GA) would mean two
> vocabularies for one fact. The stages below map the familiar names onto the enforced
> states — the state field in `harness/manifest.json` is the single source of truth, and
> the doctor enforces it against reality.

| Stage (familiar name) | Census state · location | What it means · who may use it | Exit criteria |
|---|---|---|---|
| **1. Planned** | `planned` · no code yet | A named intention: census row + role only. Doctor skips path checks. | design settled → scaffold it |
| **2. Draft** (≈ alpha) | `sandbox` · `apps/_drafts/<name>/` | Experiment: shape may change daily. Runs only when explicitly invoked. Contract + plain-language README required from day one. | tests exist + checks stay green → `candidate` |
| **3. Beta** | `candidate` · `apps/_drafts/<name>/` | Built to Green and **wired for real use from the `_drafts` path** — exactly how `/handoff` and `/incident` run today. Real users, real record rows; still explicitly pre-admission (self-admission is a doctor ERROR). OS-level betas additionally ride the `next` channel ([testflight.md](testflight.md)). | proven in real use + human decides → admission |
| **4. Staging** | `staging` · `apps/<name>/` | **Admitted on trial** (the human census flip + move out of `_drafts/`, CODEOWNERS-gated, ledger-recorded). Load-bearing but watched; the doctor WARNs if production depends on it. Time-box it. | trial period clean → `production` |
| **5. Production** | `production` · `apps/<name>/` | Fully admitted. May be depended on. Doctor ERRORs if it depends on anything less stable. | — |
| **Out** | `quarantined` (suspended in place) · `retired` (census tombstone) · `.system/trash/` (withdrawn, restorable) | | |

**Promotion mechanics (any stage):** bump the app's version + `versions[]`, flip the state
(stages 4–5 are the human's, under review), re-cut the release pins, reseal
([release.md](release.md)). Every promotion is therefore a visible diff on the spine
manifest + a release — never a silent flag-flip.

**Why "staging" and not "testing" for stage 4:** testing is what CI + the battery do at
EVERY stage (nothing ships untested); stage 4's distinguishing fact is *where it stands in
admission* — on trial, admitted, watched. `staging` already exists in the state enum and
in the doctor's dependency rules, so the name costs nothing and enforces itself.
