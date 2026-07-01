# OS/Harness reshape + sealed runtime — EXECUTION PLAN (test-first, evidence-gated to 5/5)

## ▶ START HERE (new session)

This is the **execution plan**. Run it **end-to-end, unattended**, per the **Autonomy Contract (§J)**, to the
**exact standard** set this session: test-first · evidence-gated · **5/5 only when demonstrated** · three
adversarial reviews' findings folded in (§A) · **no silent failures**. Companion architecture/vocabulary
spec: [`2026-07-01-os-harness-architecture-design.md`](2026-07-01-os-harness-architecture-design.md).

**The one setup step:** bypass permissions on + git push working. Then execute Phases 0→4 (§D), gating each
on its deterministic evals (§D2). **The new session does NOT inherit "green" — it re-earns it with evidence**,
including re-running the three adversarial reviews' checks and the full eval battery.

**Locked rulings (§K):** branch `os-reshape` + CI-gated auto-merge · one additive ledger entry · availability-only
O4 · autonomous adoption on green. **Non-negotiables:** NN1 (🔁 loop fires every message) · NN2 (dashboard
`web-lemon-ten-15.vercel.app` works exactly as is) · the ≥100-check CI merge gate preserved/improved · controls
proven **under lockdown** (build-relaxed → flipped-back-fail-closed, evidenced).

---

## Context

`os-rebuild` is a working governance/agentic OS whose components all live under `harness/sandbox/` as
unadmitted candidates, with admission coupled to *physical location* (moving files breaks imports — proven
live). We decouple **state from location**, reshape into a legible six-concept OS
(`harness · apps · skills · governance · record · docs` + `.system/`), and add a **sealed, versioned runtime**
the session boots from — separate from the messy workbench. **Evidence and actual experience trump all.**

## Definition of Done (non-negotiable)

1. 100%-confident folder mapping — every file (and all 55 registry rows) has a home; every merge explicit.
2. Clear version management (component / harness / OS) + how the OS loads in Claude + workspace.
3. **Materially identical behaviour** vs today — proven by a golden-master diff, not asserted.
4. Every change **tested and proven with evidence** (async review per §J) — no silent assertions.
5. TestFlight — trial a beta OS/harness/app before it becomes the stable running OS.
6. All controls, tests, git methods **preserved or materially improved** (≥100-check gate never weakens).
7. **The quality rubric (§B/§G) scores 5/5 on every dimension, peer-reviewed, evidenced.**

## Decisions locked

- Term **harness** (concept + folder). `harness/` is reshaped **in place** (not renamed).
- **Reshape first**, then admit apps. **Atomic sweep on branch `os-reshape`**; live session untouched until adoption.
- Beta = **channel model** (`current`/`next` + stable launcher reading a file-backed channel + `_drafts` per-app beta).
- Concurrency = fan-out reads; single-writer **enforced** (harness-lock re-keyed + wired, loop-store fixed, data-lock); worktree isolation for parallel writers.
- **Sealed runtime stays in scope and is the most-tested component.**

---

## A. What the reviews changed (fixes baked in)

**Silent-failure bugs corrected:**
- **`.github/` STAYS at repo root** — GitHub only runs workflows from `.github/workflows/`; moving it silently kills the merge gate.
- **`.gitignore` is a breaker** — moving `state/ → .system/state/` orphans `state/*.db|*.jsonl|data-lock/|harness-locks/`; re-scope every pattern + every `state/` string constant (loop-store, signal-ledger, harness-lock, data-lock) in lockstep. **Default: keep `state/` at root** (avoids this churn; relocation deferred).
- **CI test glob** → `find harness apps governance .system` (scripts move into `.system/sync/`).
- **Depth math is COMPUTED, not eyeballed** — `apps/_drafts/handoff|incident` are the **same** depth (3-deep); do NOT add a `..` (prior "+1" would write outside the repo). Generate a depth table; only `.system/sync/*` and `.system/releases/render`… wait — **render stays in `harness/`** (see below). Compute each moved file's segments-to-root.
- **Version re-cut is a scheduled step** — `git mv` makes `checkVersionBumpOnChange` see moved components as "unchanged vs tag" → mandate goes blind. Re-cut a new release + tag in the migration commit (and/or make the check rename-aware).

**Control hardening (materially improved):**
- **`structure-check` → fail-closed** on canonical-shape drift (today warn-only, exit 0 always).
- **`no-ghost-agent` → fail loud** on import-throw or zero targets (today swallows + passes).
- **Version-stamp assertion** added (tracer fail-opens to null; a miss must fail a test).
- **`architecture.json`** tiers checked against disk + `architectureVersion` bumped with the (approved) additive ledger entry.

**Sealed-runtime rescope (NOT "repoint a path"):**
- Loop reads the source tree in ~7 **fail-OPEN** runtime paths (tracer version reads, reconciler, orchestrator `REPO_ROOT` depth + doctor spawn, loop-store writes). Ship a **boot-root indirection layer** (`OS_ROOT`/manifest-anchored resolver) threaded through tracer/reconciler/loop-store/doctor — kill every `resolve(HERE,'..','..','..')` in runtime read paths.
- **`record/` + `state/` stay OUTSIDE the read-only snapshot** (written every turn).
- Snapshot **bundles the doctor's dependency chain** (checks + merged manifest + schemas + release pins) or `os:`→doctor block has nothing to spawn.
- **Cut-then-verify gate:** publish assembles the snapshot, then runs doctor + no-ghost + hostile boot smoke-test **against the snapshot**; refuses to repoint `current`/`next` on any failure.
- **Channel toggle** via a stable unversioned launcher `.system/bin/boot-<hook>.mjs` reading a **file-backed channel** `.system/state/channel` (default `current`); banner reads the same file (not expressible in static settings.json).

**Concurrency (honest):**
- `harness-lock` is dormant **and** keyed to `harness/` (regexes for bash-redirect + branch-discipline, not just `componentOf`) → re-key to `harness/`+`apps/` **and wire it live** (PreToolUse), with a colliding-write-blocked test.
- `loop-store` steals its lock after ~1s + max-based index → concurrent writers drop rows silently. Fix lock-steal (fail-closed-with-drop-record); add a **multi-session** completeness test.
- Add a **publish lock** so two sessions can't race `current`/`next`.

**Migration-mechanics review (folded):**
- **`router.mjs` (staging) + all 38 `planned` paths get explicit homes.** `router` → `harness/loop/router.mjs` (else doctor `declared-but-absent` RED). All **55 registry rows** get resolved paths; reconcile `type→kind` with the schema's **required** `type` field.
- **`render.mjs` STAYS in `harness/`** — moving it breaks the doctor's md/index/changelog byte-compare. Only release **pins** (`*.json`) move to `.system/releases/`.
- **The `manifest+registry → manifest.json` merge is a real refactor:** `checkSchemas` validates two `additionalProperties:false` files; `render`/`tracer` read two files. Author a union schema; rewrite checkSchemas + render + tracer; decide the required `boundary.sandboxDir` field; own test.
- **`checkSandboxContainment`** is a semantic rewrite: "leave `sandbox/`" → `apps/_drafts/` (candidate) vs `apps/`+`harness/` (admitted).
- **`state/` moves atomically or not at all** (`os.db` written by loop-store **and** signal-ledger; `harness-locks/` written by harness-lock, reaped by reconciler). Default = keep at root.
- **`permissions.json` write-zones** stale-silent → remap to `harness/`+`apps/`+`.system/state/`.
- **Grep-gate is SCOPED** to code+live-config; **excludes** the append-only ledger, changelog history, decision docs (they legitimately record old paths).
- **Silent-failure catchers:** CI-actually-runs (ci.yml at root + required-check binding), no-tests-silently-skipped (count ≥ known), gitignore-hygiene (no runtime state tracked).

**NON-NEGOTIABLE INVARIANTS:**
- **NN1 — 🔁 loop fires on EVERY message.** `UserPromptSubmit` (session-feedback) keeps producing the trace byte-for-byte; preserved through the reshape; **verified live** post-migration (next real prompt shows the trace).
- **NN2 — dashboard EXACTLY as is** (`https://web-lemon-ten-15.vercel.app`): `web/` **not moved** (deploy-pinned at root), sync path preserved; verified by before/after fetch + green sync.

**BUILD MODE vs LOCKED-DOWN TEST MODE (scored — dim 12):**
- **Build mode (branch only, logged):** write permissions may be relaxed (confinement fail-open tier). Never on `main`; never adopted.
- **Locked-down test mode:** flip controls back ON (confinement `decideStrict` fail-closed, `permissions.json` enforced, `harness-lock` wired); **re-run the entire battery under lockdown**. Tests count only when the real controls are enforced.
- **Flip-back verified** (W4): no residual open grant; confinement live-tier = fail-closed.
- **Git/CI invariant:** branch can't merge unless the full CI battery (≥100 = 4 checks + all `*.test.mjs`) + new evals pass; branch protection + CODEOWNERS + required-check re-verified.

---

## B. Quality rubric (5/5 gate — every dimension 5 by evidence, peer-reviewed)

1 Mapping completeness · 2 Behavioural equivalence · 3 Control integrity (fault-injected RED) · 4 Sealed-boot self-containment · 5 Edge-cases · 6 Concurrency · 7 Reversibility · 8 Peer-reviewed testing · 9 Coverage · 10 NN1 loop-every-message · 11 NN2 dashboard · 12 Access & write-governance (under lockdown) · 13 CI battery preserved/improved. **Confidence = count of green dimensions; 5/5 only when all are green + peer-reviewed + evidence pack delivered. Do not adopt until then.**

## C. Sealed-boot self-containment matrix (most tests; RED-first → GREEN after the resolver)

Isolation boot (workbench renamed away) · missing-file injection (loud fail) · wrong/blank version (refuse) · partial snapshot (cut-then-verify refuses) · stale pointer (refuse) · channel mismatch (loud refusal) · doctor-dispatch resolves inside snapshot · version-stamp survives · data-layer externality (record/state outside snapshot). Each = an executable test with recorded output.

## D. Phases (each gated: do-not-proceed-until-green + peer-reviewed)

- **P0 — Test scaffolding & golden master (no structure changes):** capture golden-master on `main`; build all rigs (grep-gate, §C matrix, check fault-injection, multi-session, version-stamp assertion, rollback drill); **prove RED-first**; peer-review the tests.
- **P1 — Reshape (branch `os-reshape`):** compute depth table; update-paths-before-move (settings.json → CI glob → merge registry into manifest + union schema → 4 checks + hardening → runtime internal paths → depth fixes → `.gitignore` + `state/` constants → `enforcement/→checks/` → `git mv` moving zones [`sandbox/→harness/loop|guard/`, `harness/releases/*.json→.system/releases/` **render stays**, `scripts→.system/sync`, `state→.system/state` *default: keep at root*; **`web/` + `.github/` pinned**] → seed `skills/ .system/bin .system/archive` → CODEOWNERS + admission rule + architecture.json + ledger → docs/spec prose); **version re-cut + re-tag**. Gate: grep-gate=0, 4 checks green, golden-master diff identical, all tests pass (fixtures updated, not passing on dead paths), CI battery ≥ baseline.
- **P2 — Sealed runtime + boot-root indirection:** build the resolver + publish + cut-then-verify + SessionStart boot check/banner. Gate: §C matrix flips RED→GREEN; cut-then-verify refuses bad snapshots.
- **P3 — Concurrency + TestFlight:** re-key + wire harness-lock; fix loop-store; publish lock; stable launcher + file-backed channel + `next`. Gate: concurrency tests green; channel toggle boots beta loudly + promote/revert atomic; per-app `_drafts` beta.
- **P4 — Adoption (under LOCKDOWN, autonomous on green):** flip controls back to fail-closed; re-run the FULL battery under lockdown (W1–W5 + F/C/G/O/S/X) + O4 (availability-only) + R1 executed + M1 final + M2 coverage + G9 ≥ baseline & CI green (auto-merge branch→main). Then **adopt autonomously** (flip `.claude/settings.json` to the launcher/snapshot) once flip-back verified (W4); commit+push evidence pack; **notify async**. Revertible via R1.

## D2. Deterministic eval catalogue (empirical pass/fail; `<x>` = phase-current path)

**Functionality:** F1 `printf '{"prompt":"os: check the harness for drift"}' | node <session-feedback>` → `.decision=="block"` + `.reason` has `🔁 OS loop` & `doctor:`. · F2 natural-language → `hookEventName=="UserPromptSubmit"` + `OPERATING PROTOCOL`. · F3 `echo '{}' | node <statusline>` → `🔁`. · F4 `node <orchestrator> --demo …` → `routed → doctor` & `outcome: completed`. · F5 golden-master byte-identical (main vs branch).
**Capability:** C1 confinement sibling read → exit 2 + `⛔ confinement`. · C2 in-repo read → exit 0. · C3 `node <doctor> --json` ×5 → all exit 0 ≤30s. · C4 `/handoff` writes to `record/handoffs/` + `docs/RESUME-HERE.md` inside repo. · C5 reconciler on injected limbo → exactly one incident.
**Governance (fault-injected):** G1 4 checks clean → exit 0. · G2 plant absent component → doctor exit 1. · G3 corrupt ledger line → governance-check exit 1. · G4 rogue/missing top-level dir → structure-check **non-zero** (hardened). · G5 (a) ghost target (b) empty targets → no-ghost exit 1 both. · G6 changed-but-unbumped → doctor RED. · G7 CODEOWNERS patterns all match real paths. · G8 ci.yml at root + discovered test count ≥ N. · G9 CI battery count ≥ baseline (≥100) & all green.
**Observability:** O1 last `runs` row has non-null `traceId,spanId,fourTuple,harnessVersion,componentVersion` (fault-inject broken manifest path → FAILS). · O2 `loop-store completeness('runs')` = complete,gaps=0,dups=0. · O3 statusline `🔁`. · O4 (NN2) fetch dashboard before/after (200 + shows data) + sync exit 0/graceful-skip (availability-only).
**Self-containment (S1–S5):** the §C matrix. **Concurrency:** X1 colliding write blocked (exit 2); X2 two loop writers → gaps=0,dups=0; X3 two publishes serialized (no torn `current`). **Reversibility:** R1 adopt → `git revert` → F1–F4 green. **Access/write-gov (LOCKDOWN):** W1 disallowed write BLOCKED; W2 foreign-lock write BLOCKED; W3 full battery green under lockdown; W4 adopted state locked-down (no residual grant); W5 branch protection + required check + direct-to-main blocked. **Meta:** M1 peer review zero high/med; M2 coverage table complete. **NN1:** F1+F2+F3 + post-adoption live-fire.

**Phase gates:** P0 = RED-first (G2,G3,S1 fail as expected) + golden-master + M1. P1 = F1–F5,C1–C5,G1–G9,O1–O3,grep-gate=0. P2 = S1–S5 RED→GREEN + O1 under snapshot boot + cut-then-verify. P3 = X1–X3 + channel toggle. P4 = full battery under lockdown (W1–W5 + F/C/G/O/S/X) + O4 + R1 + M1 + M2 + G9, then autonomous adopt.

## E. Assumptions (audited; each has a catching test)
A1 merged-manifest clean → shaky (schema validates two files); A2 env-var channel not in settings.json → launcher; A3 imports siblings → only loop internals; A4 breaker list → grep-gate (scoped) is the guarantee; A5 sealed ≠ compose-primitives → needs resolver + cut-then-verify; A6 "identical" → strengthened (version-stamp + hostile boot + multi-session).

## F. Pre-mortem → the test that kills each
`.github` move (kept at root) · state/.gitignore orphan (breaker+grep) · version cascade (re-cut+re-tag) · silent controls (fail-closed+fault-inject) · snapshot not self-contained (resolver+§C) · fail-open version-blindness (version-stamp assertion) · concurrency drop/race (multi-session+publish-lock) · irreversible adoption (rollback drill) · peer gap (independent test review).

## G. Path to 5/5 (step · why · completeness test) — see full table in the plan file; summary: every silent-failure risk is converted into a loud, fault-injected test; confidence = count of green dimensions; 5/5 only when all 13 green + peer-reviewed + evidence delivered.

## H. Logged future work (out of scope)
Memory subsystem; resource-accounting; harden confinement further; automate observability sync; auto-capture of skills; relocate `web/`→`.system/dashboard/` (needs Vercel reconfig + verified redeploy). (harness-lock wiring + loop-store fix are IN this plan.)

## J. Autonomy contract (unattended, end-to-end)
1 Never stop to ask (best default + logged note). 2 Fix-forward (debug+fix+retry, never halt). 3 Incremental, crash-safe (commit+push each green milestone). 4 Pre-decided: target `os-rebuild`, branch `os-reshape`, `node:test`, uniform candidate template, `web/` pinned, Supabase new `osr_*` tables only. 5 Never touch existing data (only code + `candidates.md` + NEW streams/tables; never rewrite the ledger except ONE additive migration entry, existing incidents/handoffs, existing Supabase tables, or any locked folder). 6 Gates async (recorded + pushed, never a live block; user reviews async). 7 Scope: Phases 0→4; stop when all green + committed/pushed.

## K. Pre-flight prerequisites (locked rulings)
- **Bypass permissions + git push** — the one setup step (user enables).
- **Merge policy** — ✅ branch `os-reshape` + CI-gated auto-merge to main on ≥100-check green.
- **Ledger entry** — ✅ one additive migration entry allowed (append-only).
- **Supabase key** — ✅ availability-only O4 (sync skips gracefully; full sync deferred).
- **Workflow-scope token** — ⚠️ if auto-merge/CI needs it, ensure present; else auto-merge waits green (no stop; notify).
- **`state/`** — ✅ keep at root (relocation deferred).
- **Vercel** — no action (`web/` pinned).
- **Adoption** — ✅ autonomous once lockdown battery green + evidence pushed; async notify; revertible (R1).
