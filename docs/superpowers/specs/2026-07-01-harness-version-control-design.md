# Harness Version Control & Change Assurance — Design

- **Status:** draft spec, awaiting review
- **Date:** 2026-07-01
- **Branch:** `design/harness-version-control`
- **Related:** [`harness/CHANGELOG.md`](../../../harness/CHANGELOG.md) ·
  [`harness/manifest.json`](../../../harness/manifest.json) ·
  [`harness/registry.json`](../../../harness/registry.json) ·
  [`governance/decisions/component-model.md`](../../../governance/decisions/component-model.md) ·
  [`harness/sandbox/reconciler/`](../../../harness/sandbox/reconciler/) ·
  [`scripts/data-lock.mjs`](../../../scripts/data-lock.mjs) ·
  [`.claude/settings.json`](../../../.claude/settings.json) ·
  [`scripts/sync-supabase.mjs`](../../../scripts/sync-supabase.mjs)

## 1. Problem

The harness is the code we edit to make the OS work, but there is no closed loop that
**ensures an intended harness change actually lands** — committed, versioned, recorded, and
pushed to GitHub. The discipline exists only on paper: `manifest.json` carries a `harnessVersion`
and a semver rule ("every state change bumps the version and adds a `CHANGELOG.md` line in the same
commit"), and [`harness/CHANGELOG.md`](../../../harness/CHANGELOG.md) is maintained by hand — but
**no check enforces it** (verified: no `doctor`/`governance-check`/CI rule inspects version or
changelog). It is exactly the kind of convention that silently doesn't happen.

This surfaced concretely when session loop-traces never reached the Vercel dashboard: the
Supabase sync is a manual, unautomated step, so "the change I asked for" (session activity on the
dashboard) never propagated — and nothing noticed. See the sync-gap note in the data flow below.

Separately, there is no **per-component** version history, no defined **unit** of versioning at the
version level (the component *model* is defined; a versioning scheme on top of it is not), and no
**local single-writer enforcement** to stop two agents editing the harness at once.

## 2. Goals

- **Per-component versioning**, keyed to each component's `contract`.
- **Deliberate harness releases** that pin the exact set of component versions.
- **Deterministic enforcement** so the version/changelog discipline is unskippable.
- **Version-stamped observability** — every run's `🔁 OS loop` trace and `record/runs.jsonl` row
  records the active release and the component versions that handled the signal.
- **Local-first with GitHub push assurance** — local is canonical; the gap "committed but not
  pushed" is surfaced, never silent — *without* blanket auto-push.
- **Single-writer enforcement, locally** — two agents cannot write the harness at the same time;
  git branching reconciles at merge, but conflict is *prevented* before the write.
- **The loop ensures, not just observes** — a harness change becomes a first-class signal that is
  tracked to a verified terminal outcome (the reconciler raises an incident if it stalls).
- **Phase 2:** a runtime pointer giving single-checkout live-stability (run the current release
  while editing the next) and per-component independent cutover.

## 3. Non-goals

- **Blanket auto-commit/push.** An auto-push hook was tried and **retired** (gov-2026-06-30-031)
  for causing repo-wide churn. Pushing stays a deliberate act.
- **Immutable full-tree snapshots** beyond git tags (rejected as over-engineering; git already
  snapshots).
- **Self-admission** of candidates into `harness/manifest.json` — that remains a human step
  ([`governance/rules/harness-admission.md`](../../../governance/rules/harness-admission.md)).
- **Rewriting existing data-layer streams** — the data layer is append-only.

## 4. Definitions

- **Component** — the existing locked definition in `component-model.md`: *a registered, contracted
  unit of executing code in `harness/`* (entry module **+ registry row + co-located
  `contract.json`**). Five **types**: `orchestrator | runner | service | hook | library`; derived
  **role**: `agent | command | query | store`. **This is the unit of versioning** — no new
  definition is introduced.
- **Contract-keyed version** — a component's semver, bumped by change to its `contract.json`
  (`input`/`output`/`exit` + `reads`/`writes` + `triggers`), not by any byte change.
- **Release** — a named, deliberately-cut set that **pins every component version**
  (`release 0.2 = orchestrator 1.2.0 + classifier 0.4.1 + …`). What the harness version names; what
  a git tag snapshots; what the Phase-2 pointer resolves. Coherent, testable, taggable.
- **Pointer** (Phase 2) — `harness/active`, naming the live release. What runs = what it resolves to.

## 5. Version model — two spaces, not one number

Two cadences → **two separate version spaces** (rather than a single coupled `0.0.0.0`), so
components can churn without touching the harness number.

### 5.1 Component version — `MAJOR.MINOR.PATCH`, contract-keyed
- **MAJOR** — contract breaks (incompatible `input`/`output`/`exit`).
- **MINOR** — contract-compatible behavior added.
- **PATCH** — internal fix, contract unchanged.
- Bumped per component, frequently. Most edits are PATCH/MINOR.

### 5.2 Harness release version — `generation.release`, deliberate
- Tracks a **different layer**: the **rails** (`manifest.json`: states, kinds, boundary, sequence)
  **plus deliberate release cuts**. It is **not** a rollup of component bumps.
- **generation** — bumps on a rails/boundary/philosophy shift (rare).
- **release** — increments each time a release is deliberately cut ("this accumulated state is worth
  capturing"). The git tag is the actual capture.
- Legitimately moves far slower than components: *a lot of components may change before a release is
  cut.*
- **Migration:** the existing `harnessVersion 0.8.0` (a 3-part semver) and the `versioning` block in
  `manifest.json` (which today reads MAJOR=boundary / MINOR=component-state / PATCH=meta) are
  **rewritten** to this scheme — `0.8.0` maps to `generation 0, release 8` (`0.8`), and the
  `versioning` rule is updated to describe the two spaces. This is a P1-a task, recorded as its own
  `CHANGELOG.md` line.

**Why both are needed:** component version tracks a component's contract; the harness release tracks
the rails + the human "worth naming" decision. Different layers → not redundant.

## 6. Architecture

### 6.1 Data at rest
| Artifact | Change | Purpose |
|---|---|---|
| `harness/registry.json` (+ `registry.schema.json`) | **add `version`** per component row | per-component semver of record |
| `harness/<type>/<component>/CHANGELOG.md` | **new**, co-located, per component | each component's own change history |
| `harness/releases/<generation.release>.json` | **new**, append-only, git-tagged | pins `{componentId: version}` + notes + date — the release |
| `harness/CHANGELOG.md` | existing | release-level log (the v1/v1.1/v2 audit trail) |
| `harness/active` | **new (Phase 2)** | names the live release the loaders resolve |
| `state/harness-locks/<component>.lock` | **new** | the single-writer mutex (see §9) |

### 6.2 Phase 1 — git-native, enforced foundation (declarative; no runtime switching)
1. **Schema + data:** add `version` to each registry row; seed per-component `CHANGELOG.md`; add the
   `releases/` records; keep the whole-harness `CHANGELOG.md`.
2. **Enforcement checks** (new, deterministic, wired into `governance-check`/`doctor` — the missing
   layer):
   - a component's `contract.json` (or its files) changed since its last tag, but its `version`
     didn't bump → **fail**;
   - a version/release bump with **no changelog line** → **fail**;
   - **reconcile** `harnessVersion` ↔ latest git tag ↔ active release record → **fail on divergence**;
   - **surface** (not block) "committed locally but not pushed" and "release tag missing on origin".
3. **Version-stamping:** the orchestrator stamps the active release + the handling components'
   versions into each run (`record/runs.jsonl`) and the `🔁 OS loop` trace.
4. **Local-first push assurance:** local is canonical; the unpushed/undeployed gap is surfaced and
   (if it stalls) raised by the reconciler — pushing itself stays deliberate.

### 6.3 Phase 2 — runtime pointer (built on Phase 1)
- **Layout:** `harness/versions/<component>/<semver>/…`. Stable, trivial **loaders** at the fixed
  paths `.claude/settings.json` already targets (`session-feedback`, `statusline`, `confinement`)
  read `harness/active`, resolve the release, and dynamically import the pinned component versions.
- **Cutover** = flip `harness/active` to a new release (+ tag + push). **Rollback** = flip back.
  Instant, decoupled from checkout.
- **Whole-harness and per-component cutover are the same act:** define a new release (bump everything
  changed, or exactly one component), flip. Every live state is a pre-pinned, testable, tagged
  release → no combinatorial compatibility checking.
- **Pre-cutover gate:** run the new release's tests + a projection dry-run before the flip.

## 7. Data flow

```
edit component ─► bump component version + component CHANGELOG line     (Phase-1 checks ENFORCE)
              ─► (when worth naming) record a release pinning the set ─► git tag snapshots it
Phase 2:      ─► assemble harness/versions/<component>/<semver>/ ─► verify (tests + projection dry-run)
              ─► cutover: flip harness/active (+ tag + push)            ◄── rollback = flip back
every run     ─► stamped with active release + component versions (trace + record/runs.jsonl)
reconciler    ─► sweeps for drift/limbo/orphaned locks ─► raises an incident
push to gh    ─► deliberate; the "unpushed" gap is surfaced, never silent
```

## 8. The assurance loop (the original ask, closed)

This makes the signal loop *ensure* rather than *observe*. A **"harness change" becomes a
first-class signal with a real terminal handler** — ending the current `unknown → no live handler`
outcome for these. The **reconciler** (which already raises incidents for signals stuck in limbo)
gains new **drift classes** it treats as incidents:
- files/contract changed but component `version` not bumped;
- release recorded but not tagged/pushed;
- release defined but never cut over (Phase 2);
- `harnessVersion` ↔ tag ↔ pointer divergence;
- an **orphaned lock** (holder dead / TTL exceeded) still held (see §9).

So "you said you'd make this change" is tracked until it is provably landed — committed, versioned,
tagged, pushed, and (Phase 2) live.

## 9. Concurrency & single-writer enforcement (local)

**Problem.** Git branching reconciles concurrent harness edits *after the fact* (at merge), but does
not *prevent* two agents/sessions from stomping the same working tree *while* editing. We need local
enforcement of single-writer, **before** the write. Two layers, each mapping to something already in
the repo:

**1. Isolation — worktree-per-writer (the branching answer, made local).** A harness edit runs in a
dedicated git **worktree** on its own branch (`EnterWorktree` / the `using-git-worktrees` skill). Two
writers = two worktrees = physically separate files; git merge reconciles. This is "git handles it
with branching," concretely local.

**2. Mutex — a harness write-lock enforced by the existing `PreToolUse` hook.** The `confinement`
hook is already a `PreToolUse` gate that BLOCKS tool calls by target path; a sibling check blocks any
`Edit`/`Write`/write-`Bash` targeting `harness/**` unless the caller holds the lock for that
component:
- **Lock record:** `state/harness-locks/<component>.lock` = `{ holder, session, pid, branch,
  worktree, ts }`. Not part of the append-only `record/` evidence.
- **Acquire:** on first harness write to a component (auto), or explicitly.
- **Enforce:** the hook resolves the target path → its component → if a *live* lock is held by a
  *different* holder, **deny** the call with a message naming the holder; else allow (and acquire).
- **Release:** on `Stop`/`SessionEnd`, explicit release, or staleness (holder pid/session dead, or
  TTL exceeded). The **reconciler** flags/clears orphaned locks.
- **Fail mode:** fail-**closed** on a detected conflict (consistent with `confinement`); fail-**open**
  on a lock-check *error* — never wedge the session over a bug in the guard.

**Granularity (decision needed — see §15).** Per-**component** locks (recommended) let two agents
edit *different* components concurrently — aligned with per-component versioning, and mirroring the
existing "sole-writer: one store owns one table" invariant ("sole-writer per component"). A coarse
whole-harness lock is simpler but serializes all harness work.

**Relation to `data-lock.mjs`.** Different concern, composes cleanly: `data-lock` makes the
append-only `record/` evidence *immutable* (tamper-evidence); this is a *write mutex* on harness
*code*. Neither replaces the other.

## 10. Failure handling

- **Loader = fail-open SPOF** (Phase 2): keep it ~10 lines, fail-open, its own tests, rarely touched
  (it is the one piece the pointer can't version — chicken-and-egg).
- **Pointer → missing/broken release:** loader fails open (turn proceeds); reconciler flags it.
- **Sources of truth:** release = tag = pointer are the *same artifact*, collapsing the earlier
  three-way divergence to one, still reconciled by a check.
- **Schema skew at cutover:** the pre-cutover projection dry-run catches it before the flip.
- **Duplication tax:** keep at most current + next release on disk; prune on cutover.
- **Orphaned/stale lock:** holder death or TTL → reconciler clears it; lock-check errors fail open.

## 11. Testing

- Every new check has unit tests (repo convention).
- Phase 2 loaders have their own tests; a **cutover + rollback** integration test.
- Reconciler tests for each new drift class (including orphaned-lock).
- Lock tests: acquire/deny/release, staleness, and the `PreToolUse` deny path.
- All four existing checks (`doctor`, `governance-check`, `structure-check`, `no-ghost-agent`) stay
  green; enforcement extends `governance-check`/`doctor`.

## 12. Governance & boundary

- Built in `harness/sandbox/` as **candidates**; **not self-admitted** into `manifest.json`.
- Data layer stays **append-only** (new streams/records only).
- Honors the **retired auto-push** lesson: no blanket push.

## 13. Decisions locked (this session)

- **A.** Unit of versioning = the existing `component-model.md` component; version **keyed to its
  `contract`**.
- **B.** Keep the harness version, **redefined** to track rails + deliberate release cuts (slow
  cadence), not a component rollup.
- **C.** **Two version spaces** — component `MAJOR.MINOR.PATCH` + harness `generation.release` —
  rather than a single `0.0.0.0`.
- **D. (proposed, pending granularity)** Concurrency = worktree isolation **+** a `PreToolUse`
  write-lock; per-component granularity recommended.
- Approach **C (release)** for Phase 2: the pointer names a **release** (pinned set), unifying
  per-component versioning and whole-harness cutover in one mechanism.
- **Per-component changelogs** (co-located), not a single central component log.

## 14. Build order

1. **P1-a** `registry.schema.json` + `registry.json`: add `version`; seed component versions; rewrite
   `manifest.json` `versioning` block + `harnessVersion` to `generation.release`.
2. **P1-b** per-component `CHANGELOG.md` scaffolding + `harness/releases/` + first release record.
3. **P1-c** enforcement checks in `governance-check`/`doctor` (+ tests).
4. **P1-d** version-stamping in the orchestrator (trace + `runs.jsonl`).
5. **P1-e** local-first push-assurance surfacing + reconciler drift classes (+ tests).
6. **P1-f** harness write-lock + `PreToolUse` enforcement + `Stop`/`SessionEnd` release +
   reconciler orphan-clear (+ tests).
7. **P2-a** `harness/versions/` layout + stable loaders + `harness/active` (+ tests).
8. **P2-b** cutover/rollback flow + pre-cutover gate (+ integration test).

## 15. Open questions (for the plan, not blocking)

- **Lock granularity:** per-component (recommended) vs whole-harness.
- **Data layer under worktrees:** `record/` and `state/` live in the working tree, so parallel
  harness-editing worktrees would fork them. Decide whether editing worktrees share a canonical
  data-layer location or defer data writes to the primary tree.
- **Sandbox reconciliation:** the live loop candidates (`orchestrator`, `classifier`, …) aren't yet
  registry rows as themselves; they get versioned when they get rows + contracts. Sequence this.
- **Prune policy** for old `harness/versions/<component>/<semver>/` directories.
- **Exact push-assurance trigger** — on `Stop`/`SessionEnd`, on release cut, or reconciler-only.
- Whether per-component `CHANGELOG.md` files should be generated/validated from a structured source
  to keep them consistent.
