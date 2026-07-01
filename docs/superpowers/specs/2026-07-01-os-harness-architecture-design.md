# OS + Harness — architecture & vocabulary (design spec)

> **Status:** DRAFT for review · 2026-07-01 · not yet admitted, no code moved.
> **Scope:** the definitions, the finalised-core subsystem model, the folder structure, and the
> sealed-runtime / boot-legibility / placement / bin decisions. Grounded in CS (Apple docs,
> Silberschatz, Tanenbaum, NIST reference-monitor), then simplified to a day-to-day model.
> **Provenance:** five verified analyses this session (boot-graph, doc-inventory, publish-closure;
> terminology whole/part; naming-vs-industry; CS-grounded definitions with web sources; finalised-core
> + folder structure with an adversarial completeness/simplicity critic). Claims tagged
> `built | candidate | planned | design-direction` are honest to the repo as of this date.

---

## 1. The whole thing in one breath (the daily model)

**The OS is the whole repo. Inside it, five things are all you hold day-to-day:**

| Concept | Folder | Plain meaning |
|---|---|---|
| **Kernel** | `kernel/` | The harness — the always-on core that sees every turn and decides what happens. |
| **Apps** | `apps/` | The workers (handlers + agents) the kernel routes to. Add a feature = add a folder. |
| **Skills** | `skills/` | Captured, reusable procedures — the OS's runbooks ("how to deploy Vercel"), saved once and recalled. |
| **Governance** | `governance/` | The rules + the checks + the human gate. The law the kernel enforces. |
| **Record** | `record/` | The append-only ledger — what actually happened. |
| **Docs** | `docs/` | The manual. |

Everything else — host wiring, CI, sync, releases, projections — lives back-of-house in one
`.system/` folder you rarely touch. **If you can name those six, you can navigate the whole OS.**

---

## 2. Definitions (CS-grounded)

### OS

> **The OS is system software for a single agentic actor: it manages that actor's scarce resources
> — its *turns*, its *tool calls*, and its *append-only record* — acts as the intermediary between
> the human/model and the host, and provides the common governed services (the signal loop, the
> checks) that every app runs on top of.**

Anchored in the canonical definition — *"system software that manages … resources, and provides
common services for … programs"* (Wikipedia); *"an intermediary … a resource allocator … a control
program"* (Silberschatz); *"extended machine + resource manager"* (Tanenbaum). The OS is the **whole**
(like a Linux distro), not the engine inside it.

### Harness (= the kernel)

> **The harness is this OS's kernel — specifically a *reference monitor* for the session: the
> always-invoked, boots-first core that every turn and every tool call must pass through, and that
> holds allow / deny / bypass / steer authority over the one actor. It is defined by that role and
> its invariant properties — not by whichever components implement it in any given version.**

We keep the word **harness** (native to agentic systems) for the thing computing calls a **kernel**.
Grounded in: the kernel *"always has complete control … always resident in memory"* (Wikipedia); the
reference monitor's **NEAT** properties — **N**on-bypassable, **A**lways-invoked, **E**valuable,
**T**amper-proof (NIST / Wikipedia); Apple's SIP, which *"applies to every process … regardless of …
administrative privileges"* (Apple Platform Security).

**Invariant properties (hold regardless of which apps exist):** boots first · always invoked · complete
mediation · terminal authority (allow / deny+substitute / steer) · records every run · stable across a
changing app set.

**Why not a component list:** enumerating today's parts (classifier, orchestrator, …) makes the
definition false the moment the set changes — and at v1 it will. NIST defines a reference monitor as *"a
set of design requirements,"* not a parts list, precisely so it survives churn. Which handlers sit behind
the dispatch table is a fact about *userland*, not about what the harness **is**.

**Deliberate inversions vs a real kernel (do not gloss these):**
- **Fail-OPEN, not fail-closed.** Any hook error/timeout exits 0 and the turn proceeds ("availability
  over false authority"). A real reference monitor denies by default. *This is the single most important
  safety inversion.*
- **Privilege = hook-ordering + `decision:block`**, not CPU rings / supervisor mode / hardware.
- **Sits *above* the model**, steering a component more capable than itself — not *beneath* hardware.
- **Enforcement is bifurcated:** only the `os:` path is truly enforced (model bypassed); the
  natural-language path is *steered* and can be ignored.

---

## 3. Two views of the same system (read this first)

The design has **two views at different altitudes — not two competing structures:**
- **Physical (canonical): the folder tree (§5)** — where files live, what you navigate. Five folders.
- **Logical: the capability map (below)** — what the OS *does*. **A capability is not a folder;** several
  capabilities live in one folder, and a *planned* capability may have no folder yet (a "planned interface").

**Definition vs evidence — where things live (the rule that resolves "where do manifests/registers go?"):**
*authored definition* lives **with what it defines** — the manifest+registry (`kernel.json`) in `kernel/`,
the laws + the candidate register in `governance/`. *Recorded evidence* (what happened) lives **only in
`record/`**. Manifests and registers are definition, so they are **never** in `record/`.

## 3a. The finalised core — capabilities grouped by folder

Status is honest to today: `built | candidate | planned | design-direction`.

### `kernel/` — the harness (two folders + planned capabilities)

- **`loop/` — the signal loop.** Sees every turn, routes it to an app, records the outcome, traces it
  (the 🔁), and guarantees nothing fails silently (fault & recovery + the reconciler backstop). *This one
  folder is everything I earlier over-split into "Mediation / Scheduler-routing / Fault & recovery /
  Observability-trace."* CS analog: kernel + syscall surface + scheduler-dispatch + tracing + exception
  model. **Status:** candidate (loop) / built (hook wiring + trace).
- **`guard/` — the fence.** Runs before every tool call; can block it, or block/bypass the model; holds
  the write-locks. CS analog: protection rings + integrity. **Status:** candidate (live tier fail-open) /
  built-but-dormant (hardened tiers).
- **Planned capabilities (no folder yet — the "planned interface"):** **budget / accounting** (meter
  turns, tool calls, tokens — CS: cgroups/quotas; the biggest gap vs our own OS definition) and **memory**
  working-set management (see §4). **Status:** planned.

> Observability has two ends: **trace** (the mechanism, in `loop/` — the 🔁 line) and the **dashboard**
> (the view over `record/`, in `.system/dashboard/`). Same subsystem, different folders.

### `apps/` — userland

> **Handler vs agent:** a **handler** is *deterministic* code (same input → same output: classifier,
> reconciler); an **agent** is *LLM-driven* (it reasons: investigator). Both are apps the kernel routes
> to — the only difference is deterministic vs model-driven.

| Subsystem | CS analog | Role here | Status |
|---|---|---|---|
| **Handlers & agents** | processes / applications | The workers the kernel routes to: deterministic runners (classifier, estimator, reconciler) and LLM agents (investigator; planned clarifier→…→deployer chain, which is a *workflow on top*, not its own subsystem). Candidates live in `apps/_drafts/`. | mixed (most candidate) |

### `skills/` — captured reusable procedures (procedural memory)

A **skill is a captured, reusable method** — a documented procedure (the steps/commands that worked + when
to use it), saved once from a successful run, versioned, recalled and reapplied later. It's how the OS
*learns*: deploy Vercel once → capture → recall & reapply. **apps *do* work; skills are learned recipes for
*how*** (a skill may call apps). The OS owns them in `skills/`; the host surfaces them via `.claude/skills/`.
A new skill bumps the **OS** version, not the harness.

| Subsystem | CS analog | Role here | Status |
|---|---|---|---|
| **Skills** | standard library / runbooks / stored procedures | Captured, reusable procedures the model/agents recall and reapply. **Procedural memory** — the "how", complementing the record's "what happened" and long-term "facts". Capture is manual now, automatic later. | planned (concept adopted) |

### `governance/` — the law + the human control plane

| Subsystem | CS analog | Role here | Status |
|---|---|---|---|
| **Identity & permissions** | users/groups, capabilities | `permissions.json` + rules bound the single actor's reach (policy: what's allowed in principle). | candidate |
| **Enforcement / the checks** | protection + integrity verify | `doctor`, `governance-check`, `structure-check`, `no-ghost-agent` (mechanism: does this pass right now). | candidate |
| **Human approval gate** | root / admin authority | The defining control boundary: admission (a human move), `os:`-enforced vs steered. Named as one concept. | candidate |

### `record/` — durable truth, and Memory over it

| Subsystem | CS analog | Role here | Status |
|---|---|---|---|
| **Data layer** | journaled/log-structured FS | Append-only `record/*.jsonl` (single-writer-per-stream, never rewritten) → `state/os.db` projection; `scripts/data-lock.mjs` enforces immutability (chflags + checksum baseline). | built |
| **Memory** (see §4) | RAM + virtual memory + paging | The *manager* over the data layer: working / long-term / retrieval. Substrate exists; manager doesn't. | **planned** |

### `.system/` — back-of-house machinery

| Subsystem | CS analog | Role here | Status |
|---|---|---|---|
| **Host & integration** | device drivers + network stack | Host adapters (filesystem, Bash, editor writes) **and** external reach (MCP, Supabase, GitHub, web). Host effects are real; the confinement over them is fail-open (~8/10 escapable) — hardened tiers dormant. Network reach is the biggest un-mediated risk → should route through the same permission layer. | built (adapters, unconfined) / built-but-dormant (MCP hardening) |
| **Lifecycle & versioning** | bootloader + init + system image | Claude Code loads `.claude/settings.json` → wires the kernel → mediates turn one; `kernel.json` + releases = the versioned identity. | built (boot) / design-direction (sealed image) |

> **Command interface (the shell).** The `os:` sigil + slash commands are how you *address* the OS.
> It's parsed by the kernel itself (not a separate userland shell — a boundary a real OS keeps separate).
> It's the front-of-house interaction surface; mechanically it lives in the kernel's mediation step.

**Future-maturity note (not v1):** a **timer / scheduled-work** subsystem (durable wakeups, deferred
work) is genuinely absent and worth naming for later.

---

## 4. Memory as a first-class subsystem (planned)

Memory is the agentic-OS analog of memory management (RAM + virtual memory + paging), **not** just a
folder of logs. Three tiers:

1. **Working / session memory** — the fast, volatile "RAM": the live context window + in-flight loop
   state. Bounded and expensive → the scarce resource the scheduler *should* budget around (aspirational
   link today).
2. **Long-term store** — the durable "disk" that outlives a session: stable facts, decisions,
   preferences, distilled learnings. Today only raw substrate exists (`record/`, and the user
   auto-memory `MEMORY.md`).
3. **Retrieval** — the "pager/MMU": decides which long-term items to fault into the working set for a
   turn, and what to evict/summarise when the window fills.

**Data layer vs memory (load-bearing distinction):** the append-only data layer is memory's *physical
medium* and guarantees **durability + immutability**; the memory subsystem is the *manager* over it and
guarantees **relevance + recall** (consolidation → index → page-in). Keeping them distinct is the
strongest structural move here. Back-of-house: you should feel continuity, not operate a cache.

---

## 4a. Version model + workbench ↔ released split

**Three nested version scopes** — Apple analogy: `macOS 15.1` : `Darwin/XNU build` : `daemon versions`
= **OS : harness : component**.

| Scope | Versions… | Bumps when | Lives in | Today |
|---|---|---|---|---|
| **Component** | one app / kernel-part | *that unit's* code changes | `kernel.json` row + per-piece changelog | ✅ exists |
| **Harness (kernel)** | the engine as a **pinned set** | any admitted component changes | a release record pinning every component + git tag `harness-vX.Y` | ✅ exists (`releases/*.json`, tags, doctor pin-check) |
| **OS** | the **whole product you boot** | you cut + publish a release | sealed snapshot `.system/releases/<v>/` + `architectureVersion` (shape) | ⚠️ release exists; sealed snapshot is new |

Plus two **shape versions** (rarely change): `manifestVersion` (the `kernel.json` format) and
`architectureVersion` (the OS tiers/boundary/data-shape, in `governance/architecture.json`).

**OS and harness versions are SEPARATE** (the Apple model): the **harness (kernel) version** bumps *only*
when the kernel changes (`loop/`, `guard/`, or the rails) — apps never touch it. The **OS version** bumps
on *any* shipped change you boot, apps included. So *an app change → a new OS release, same harness
version* — exactly like "Safari update → new macOS point release, same Darwin kernel." Every OS release
pins `{ harnessVersion, every component version }`; `harnessVersion` stays sticky until a kernel part
actually moves. Day-to-day grains: bump a **component**, cut an **OS release** (pin + snapshot + tag); the
harness version rides along only when the kernel changed.

**Two zones, two bridges:**
- **Workbench (source)** — the whole working tree; you *edit* here; candidates in `apps/_drafts/`; messy
  by design. *Nothing here is the running OS.*
- **Released/booted OS** — `.system/releases/<v>/` (sealed, self-contained snapshot of the admitted set),
  `current` → live. **The session boots only from here.** Read-only, like Apple's Signed System Volume.
- **Admission** (workbench → releasable): move `apps/_drafts/<x>/ → apps/<x>/` — the human gate.
- **Publish / cut a release** (releasable → booted): pin versions → snapshot the admitted closure →
  repoint `current` → tag. Stamps the harness/OS version.

**Loop:** `edit → admit (draft→app) → cut OS release (pin + snapshot + tag) → boot from current`.
**Time-machine:** every `.system/releases/<v>/` retained → rollback = repoint `current`; `.system/bin/`
catches deletions; SessionStart + `current`'s `kernel.json` report the booted version.

---

## 5. Folder structure (evolution, not rewrite)

```
os-rebuild/                    the OS (the whole system)
│
├── kernel/                    THE HARNESS — the always-on core
│   ├── loop/                  signal loop + trace: hook · orchestrator · classifier · estimator · tracer
│   ├── guard/                 the fence: confinement · write-lock · block authority
│   └── kernel.json            one spine file (manifest + registry merged)
│
├── apps/                      USERLAND — the workers the kernel routes to (they DO the work)
│   ├── <app>/                 one folder each: index.mjs · contract.json · notes
│   └── _drafts/               candidates not yet admitted (was sandbox/)
│
├── skills/                    RUNBOOKS — captured reusable procedures (how-to), recalled & reapplied
│
├── governance/                THE RULES — permissions · rules · decisions
│   └── checks/                doctor · governance-check · structure-check · no-ghost-agent
│
├── record/                    THE LEDGER — append-only evidence (governance-ledger tracked)
├── docs/                      THE MANUAL
│
├── .claude/                   HOST WIRING (pinned at root) — settings.json · commands · skills
└── .system/                   BACK-OF-HOUSE — rarely touched
    ├── ci/  sync/  dashboard/    CI (.github) · scripts · observability view (web)
    ├── releases/  state/         version pins & sealed snapshots · projections
    └── bin/  archive/            deleted items (restorable, purgeable) · archive (retired, kept)
```

**Structure principles:** OS = the whole repo · harness = kernel gets its own top folder · one
subsystem/app = one folder (add a feature = add a folder) · front-of-house is six concepts
(`kernel · apps · skills · governance · record · docs`) · back-of-house is one `.system/` dot-folder
(plus `.claude/` pinned at root by the host) · **type is a field, not a folder** (collapse the five
near-empty `orchestrators/ runners/ services/ hooks/ lib/`) · one spine file (`kernel.json` — the doctor
already merges manifest+registry) · **admission stays a visible human move** (promote = move out of
`apps/_drafts/`).

**1:1 migration map (no code changes — only location + fewer names to remember):**

| Today | Becomes |
|---|---|
| `harness/sandbox/` loop parts (session-feedback, orchestrator, classifier, estimator, tracer) | `kernel/loop/` |
| `harness/sandbox/` confinement, harness-lock | `kernel/guard/` |
| `harness/manifest.json` + `harness/registry.json` | `kernel/kernel.json` (merged) |
| `harness/orchestrators/ runners/ services/ hooks/ lib/` (near-empty type-folders) | collapsed → `kind` field on each app |
| admitted `harness/sandbox/<x>` | `apps/<x>/`; still-candidate → `apps/_drafts/<x>/` |
| `governance/enforcement/` | `governance/checks/` |
| `harness/releases/`, schemas, `render.mjs` | `.system/releases/` |
| `.claude/` (settings.json, commands, skills) | **stays at repo root** — Claude Code only loads it there. Back-of-house *conceptually* (optionally symlinked from `.system/claude/`); its hook commands point at `.system/releases/current/…`. |
| `state/`, `.github/`, `scripts/`, `web/` | `.system/state/ · ci/ · sync/ · dashboard/` |
| `record/`, `docs/` | unchanged (front-of-house) |

> **Skills / config / utilities:** skills = the shortcut layer (host wiring in `.claude/skills` + `.claude/commands`; the *work* a skill does lives in `apps/`). Config = policy in `governance/` (`permissions.json`, rules, `architecture.json`, `environment.json`) + host wiring in `.claude/settings.json`. Utilities = `.system/` (standalone) or `kernel/lib/` (kernel-shared). No new top-level folders unless skills become a first-class front-of-house `skills/` library (open decision).

---

## 6. Sealed runtime, boot legibility, placement & the bin (folded-in decisions)

### 6a. Sealed / published runtime (design-direction)
The session boots from a **published snapshot** of the admitted core — a self-contained, flat-sibling
copy under `.system/releases/<version>/` with `current` pointing at the live one. Deliberately analogous
to Apple's read-only **Signed System Volume** (a boots-first, tamper-evident seal). **Not built** —
today the session boots the source directly. This is what makes "admission = republish (a metadata +
publish step)" rather than the fragile file-move that broke earlier. The one real wiring detail: the
kernel's `doctor`-dispatch path must be made **configurable/source-anchored** (it currently assumes the
source folder depth) so the publish is self-contained.

### 6b. Ensuring the harness is booted + boot legibility

**Boot mechanism:** Claude Code reads **`.claude/settings.json` at the repo root** on session start and
registers the hooks (`statusLine`, `UserPromptSubmit`, `PreToolUse`); their commands point at
`.system/releases/current/…`. That wiring *is* the boot. `.claude/` cannot move (host requirement).

**Ensuring + proving boot (make non-boot LOUD):** there is no SessionStart hook today — net-new work:
- Add a **SessionStart** hook that boot-checks (`.system/releases/current` resolves, its `kernel.json`
  version matches the pin) and prints `🖥 OS vX.Y booted · N components · <sha>` first thing; missing/stale
  snapshot → a loud warning (still fail-open).
- The **statusline** shows the running version *every turn* (always-visible liveness proof).
- **Turn one's 🔁 trace** proves the `UserPromptSubmit` hook fired.
- Optional: write a **boot attestation** to `record/` on SessionStart so the reconciler can flag any
  session that ran with no boot record.

**Honest limit:** we cannot *force* the host to run hooks — the harness's authority is a host-honored
convention, not a hardware guarantee. What we guarantee is that **absence is visible** (no version line /
no 🔁 = not booted). Because `current` pins exactly one sealed version, *which* harness booted is
deterministic and reported.

### 6c. Document / data placement policy
The repo already implements ~80% of this; we're mostly naming it:
- **In the OS + tracked:** the executable kernel + `kernel.json` + governance data + the ledger.
- **Data layer, gitignored:** the `record/*.jsonl` runtime streams.
- **Source-tracked manual:** `docs/`, `.system/` tooling.
- **Handoffs:** your instinct (they needn't be git-managed) matches the *end-state* (a gitignored →
  Data-Layer stream), but the repo currently **hard-requires them tracked** (`governance/rules/handoffs.md`
  + the handoff code + its test + contract). So it's a **sequenced governance change**, not a `.gitignore`
  edit. **Immediate clean win:** move `docs/sessions/` write-ups out of git (nothing enforces them).

### 6d. Deleted items + archive (two distinct stores)

Two separate, legible surfaces on top of git — **not** the same thing:

- **`.system/bin/` — deleted items (soft-delete).** *"Removed — undo if wrong."* Withdrawing an app,
  deleting a skill/doc **moves** it here with metadata (what / when / why / origin) + one-step **restore**.
  Transient and **purgeable**. OS analogy: the Trash.
- **`.system/archive/` — archive.** *"Retired on purpose — keep for the record."* Superseded designs,
  retired apps/skills/docs you're done with but want to keep. Durable, **not auto-purged**, out of the
  daily view. OS analogy: retired system images / old blueprints.

**Lifecycle:** `active → delete → bin/ → purge` (or promote to `archive/` if worth keeping); or
`active → retire on purpose → archive/` (skip the bin). Git is the deep net under both.

**Boundaries:** (1) **neither touches `record/`** — the append-only ledger is immutable evidence; you
archive *code/docs/designs*, never *truth*. (2) **Old OS versions are not archive** — retained releases
live in `.system/releases/` (the active rollback time-machine); `archive/` is for things no longer in any
release. **Scope of both:** components, apps, skills, docs, superseded designs.

---

## 7. OS ⟷ computer OS (sourced comparison)

| Subsystem | Computer OS | This system | Verdict |
|---|---|---|---|
| Kernel | Privileged always-running core | The harness (above the model; "protection" = hook order) | analogous |
| System calls | User→kernel trap | UserPromptSubmit + PreToolUse hooks | analogous |
| Scheduler | Time-slices many threads | Orchestrator dispatch, one signal, no preemption | analogous |
| Processes/apps | Many passive isolated processes | One agentic actor + routed handlers | different |
| Memory | Virtual address spaces | **Absent today** (planned first-class subsystem) | absent → planned |
| File system | Read/write storage | Append-only ledger → `os.db` | analogous (log-shaped) |
| Drivers | Device I/O | Host adapters + hooks | analogous |
| Shell | Separate userland interpreter | `os:` sigil parsed by the kernel itself | partially analogous |
| Users/perms | Multi-user isolation | One actor; permissions + confinement | different |
| Boot | firmware→bootloader→kernel→init | Claude Code → settings.json → hooks → kernel (sealed image = design-direction) | analogous |
| Protection | Hardware rings; fails **closed** | Hook-order + `decision:block`; **fails OPEN** | different |

---

## 8. Honest differences & known gaps

- Governs **one powerful agentic actor**, not many passive processes.
- **Fail-OPEN**, where a real kernel fails closed (deliberate; the key safety inversion).
- **Privilege is a software convention** (hook order + `decision:block`), not hardware.
- **Resource accounting is missing** — the OS claims to manage scarce resources (turns/tool-calls) but
  nothing meters them yet. Highest-priority completeness gap.
- **Memory manager absent** (substrate only).
- **Observability sync is dormant** — `os.db → Supabase → Vercel` is manual/keyed and not reliably
  reaching the hosted dashboard. Known gap.
- **Confinement is fail-open / ~8-of-10 escapable**; hardened tiers built but dormant.
- **Most apps are unadmitted candidates** — the live governed set is smaller than the codebase.
- **No concurrency, no timers** — one actor, one signal; durable wakeups are future work.

---

## 9. Open decisions for you

1. **Naming:** keep `harness` as the term for the kernel role? (decided: yes) → adopt `kernel/` as the folder.
2. **Subsystem model:** accept the collapsed set (five daily folders; ~10 subsystems nested under them)?
3. **Bin scope:** components + versions + docs (recommended), or components + versions only?
4. **Sequencing:** do the folder migration as one mechanical, revertible sweep on a branch — before or
   after admitting the first app (orchestrator)?

---

## 10. Sources

Wikipedia (Operating system, Kernel, Reference monitor, System call) · Encyclopaedia Britannica ·
Silberschatz, *Operating System Concepts* Ch.1 · Tanenbaum, *Modern Operating Systems* Ch.1 · NIST CSRC
glossary (reference monitor) · Apple Platform Security (System Integrity Protection, Signed System Volume).
