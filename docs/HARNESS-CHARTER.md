# Harness Charter

> The constitution of the harness: what it is, where its edges are, how it is
> governed, and how it changes. Human-readable twin of the machine-readable
> [`harness/manifest.json`](harness/manifest.json). When the two disagree, the
> **manifest wins** — this charter is prose; the manifest is law.

Status: draft v0.1.0 · 2026-06-30 · supersedes nothing yet (reconciles with
[`HARNESS.md`](HARNESS.md), which becomes a generated boundary map under this charter).

---

## 0. The one rule

**Editing the harness is editing the manifest.** Every agent, gate, hook, config,
and environment dependency the harness relies on is declared in
[`harness/manifest.json`](harness/manifest.json). If it's wired but not declared,
the drift-check fails. If it's declared but missing, the drift-check fails. There
is no third place the harness "really" lives.

This single rule delivers all seven goals: you know what exists (the manifest
lists it), the harness is defined (the manifest *is* the definition), it self-polices
(the doctor checks reality against the manifest), and nothing changes the harness
without changing one reviewed file.

## 1. What the harness is

The harness is the deterministic wrapper around the model that turns raw model
ability into repeatable, gated, evidenced work. Short definition:
[`definitions/harness.md`](definitions/harness.md).

```
OS repository = harness + operating method + experiments
harness        = engine + runtime/store + host adapters + environment
```

Everything the harness contains is one of the `kinds` in the manifest:
`engine-agent, router, gate, runtime, store, governance, hook, host-adapter,
config, environment, chain-stage, observability, tool, experiment`.

What is **not** harness (stays in the repo, excluded from the boundary):
the operating method (`principles.md`, `specs/`, `decisions/`, `definitions/`,
`learnings/`), and experiments (`sandbox/`, generated outputs).

## 2. Single source of truth — and its MD/JSON twins

Critical harness facts exist in **two synchronized forms**:

| Machine-readable (source) | Human-readable (generated) |
|---|---|
| `harness/manifest.json` | `harness/manifest.md` (via `harness/render.mjs`) |
| `harness/manifest.schema.json` | this charter |

The JSON is the source of truth; the MD is generated from it and **never edited by
hand**. The doctor's `md-twin-stale` check makes divergence impossible to commit
silently. Rule of thumb: **anything load-bearing gets both a JSON form (deterministic,
checkable) and an MD form (readable).**

## 3. Production vs sandbox — a state, not a place

A component is in the **production harness if and only if** its manifest `state` is
`production`. The promotion axis:

| State | Meaning | Where it may live | Production may depend on it? |
|---|---|---|---|
| `production` | approved, tested, load-bearing | `harness/` (target) | yes |
| `staging` | built, under test, candidate for promotion | in place / `sandbox/` | only transiently (doctor warns) |
| `sandbox` | experimental, isolated | `sandbox/` | **no** (doctor errors) |
| `quarantined` | suspect, contained pending decision | `sandbox/` | **no** (doctor errors) |
| `retired` | superseded, kept for history | anywhere | **no** |

**Boundary model:** directory + manifest, on one branch. `harness/` holds production;
`sandbox/` holds experiments. **Phase 0 (now) declares the boundary in the manifest
and leaves code in place** — physical relocation is a later, gated step. `master`
stays the single source of truth; branches are only transient change vehicles merged
via PR.

The doctor enforces the load-bearing invariant: **production never depends on
sandbox or quarantined components.**

## 4. The promotion contract — the build rules

A component moves toward production by passing the **same chain it builds work
through**, pointed at itself:

```
sandbox  --frame+scope+plan-->  staging  --test (>=8/10) + human approve-->  production
```

Rules that keep the core solid and non-sprawling:
1. A component enters `production` only via this contract — never by editing the manifest alone.
2. Promotion is **human-approved**. The harness may build and stage autonomously; it may not self-promote.
3. Every state change **bumps `harnessVersion`** and adds a `harness/CHANGELOG.md` line in the same commit.
4. Production depends only on production (staging tolerated transiently).
5. New code lands in `sandbox/` first; it is invisible to the production chain until promoted.
6. Demotion/quarantine is always allowed and is the safe response to doubt.

## 5. The shape — a testable sequence from session through monitor

The harness has an explicit, ordered shape declared in `manifest.sequence` and
checked by the doctor. The canonical run:

```
session-start → capture(idea) → signal-extract → classify → frame → scope → plan
            → route → build → assure(test) → ship(deploy) → observe(monitor)
intake ─────────────┤ understand ──────────────────┤ shape ──┤ execute ──┤ assure ┤ ship ┤ observe
```

Each step maps to a declared component and/or chain stage. The "signal extractor"
is `tagger`; the "clarifier/classifier before the Orchestrator" is `clarify-gate`.
The doctor's sequence checks guarantee every step resolves to something real and
warns when a step still relies on a non-production component (today: `ship` →
`deployer` is staging; `observe` → `monitor` is missing).

## 6. The environment — making the runtime deterministic

The harness's behaviour is `repo code × Claude Code environment × execution context`.
All three are declared in `manifest.environment` and `manifest.executionContexts`:

- **Claude Code config** — `settings.json` (hooks, permissions), the hook wiring the
  laws depend on. *Currently not pinned in-repo — Phase 2 fixes this.*
- **Plugins / skills / MCP servers** — the capability set of a session. *Currently
  host-level and undeclared — Phase 2 adds a `.mcp.json` and a skills/plugins manifest.*
- **Execution context** — local and cloud are **both first-class**. Laws must key off
  **repo identity** (git remote + sentinel), not an absolute path. *The path-hardcoded
  Law 5/6 are a portability bug fixed in Phase 2.*

Until then, the doctor reports these as explicit `WARN`s so the gap is never invisible.

## 7. Execution contexts (local + cloud)

| id | root | host | canonical |
|---|---|---|---|
| local | `/Users/jeremyjames/Projects/OS` | macOS / Claude Code + Codex | yes |
| cloud | `/home/user/OS` | Claude Code on the web | yes |

The harness must run identically in both. The doctor's `unknown-context` check
fails any run from an undeclared environment.

## 8. Versioning

`harnessVersion` (semver) versions the boundary itself, independent of git:
**MAJOR** = boundary/contract change, **MINOR** = component added/promoted/demoted,
**PATCH** = metadata/wiring. History lives in [`harness/CHANGELOG.md`](harness/CHANGELOG.md).
This is how you answer "what changed about the harness, and when" without reading git.

## 9. Self-policing

[`governance/enforcement/doctor.mjs`](governance/enforcement/doctor.mjs) is the drift-check. It runs the manifest
against reality and **fails closed on any ERROR**:

- declared-but-absent / present-but-undeclared component
- missing dependency / production-depends-on-unstable
- malformed sequence (order gap, unresolved step)
- (warnings: staging deps, unpinned environment, missing chain stages, stale MD twin)

Wiring target (Phase 1): the doctor runs in `.githooks/pre-push` and as
`node governance/enforcement/doctor.mjs`, so no harness change can merge while the boundary is in drift.

## 10. GitHub rules & procedures — never lose control again

Three layers protect the codebase (see
[`specs/framework-three-governance-layers-2026-06-23.md`](specs/framework-three-governance-layers-2026-06-23.md)):

1. **Local laws** — `.githooks/pre-push` + `overseer/decision-enforcer.mjs` (9 enforced).
2. **GitHub platform** — branch protection on `master`: require PR + review, require
   status checks (doctor + tests), no force-push, CODEOWNERS on `harness/`, `overseer/`,
   `hooks/`, `decisions/`. *Drafted in
   [`specs/config-github-branch-protection-2026-06-23.md`](specs/config-github-branch-protection-2026-06-23.md),
   NOT yet configured — this is the single biggest open control gap.*
3. **Human judgment** — review against the principles.

Known control gaps (tracked in `manifest.governance.gaps`): `core.hooksPath` not
configured (local laws may not fire on a fresh clone or in cloud); GitHub branch
protection not configured; no unified violation audit (Law 11).

## 11. The work chain (idea → … → monitor)

The restored spine, and its honest status:

| Stage | Status |
|---|---|
| idea, pre-frame, frame, scope, plan, build, test | present |
| **deploy** | partial (deployer built, no formal contract) |
| **monitor** | **missing** — no stage, template, or post-Done observation loop |

Phase 3 adds the `monitor` contract and a `deploy` contract, and surfaces the
signal-extract → classify → route flow as observable stages with end-to-end tracing.

## 12. How to use & maintain

```sh
node governance/enforcement/doctor.mjs              # is the harness in drift? (fail-closed)
node governance/enforcement/doctor.mjs --inventory  # what's in the harness, by state
node harness/render.mjs --write      # regenerate harness/manifest.md after editing the JSON
node --test governance/enforcement/doctor.test.mjs  # prove the drift-check still works
```

To change the harness: edit `harness/manifest.json`, bump `harnessVersion`, add a
`CHANGELOG.md` line, regenerate the MD twin, run the doctor, commit. To add a
capability: build it in `sandbox/`, stage it, pass the promotion contract, then flip
its state to `production`.

## 13. Roadmap

- **Phase 0 (this pass):** charter + manifest + doctor + MD twin. Boundary declared; no code moved. ✅
- **Phase 1:** wire the doctor into pre-push; `harness doctor` as a first-class command.
- **Phase 2:** pin the environment (tracked settings, `.mcp.json`, skills/plugins manifest); generalize the path-laws to repo-identity; configure GitHub branch protection.
- **Phase 3:** restore the chain — add `monitor` + `deploy` contracts, surface the front-door flow, add end-to-end work-item tracing, revive the work-item DB surface.
- **Phase 4:** hand the loop to the harness — it builds self-changes in `sandbox/`, runs them through its own chain, and you approve each promotion to production.
