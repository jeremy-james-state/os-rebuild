# Architecture conformance review — built OS vs the design spec

> Reviewed 2026-07-02 at release 1.0, against
> [`2026-07-01-os-harness-architecture-design.md`](2026-07-01-os-harness-architecture-design.md)
> (the DRAFT vocabulary/architecture spec) and the locked rulings of
> [`2026-07-01-os-reshape-execution-plan.md`](2026-07-01-os-reshape-execution-plan.md).
> Verdicts: **MATCHES** · **DEVIATES (justified)** · **TBD** (kept as-is deliberately, decision open).

## The six front-of-house concepts (§1, §5)

| Design | Built | Verdict |
|---|---|---|
| Kernel → `kernel/` | **`harness/`** (loop/ + guard/) | **DEVIATES (justified).** The design doc itself rules (§2) that *the word harness is kept* for the kernel role; the execution plan then locked "harness (concept + folder), reshaped in place". One name for one concept, zero churn on every path/reader/doc. A later rename to `kernel/` would be a mechanical sweep the grep-gate + rig can gate — **folder name TBD** if the Apple-style vocabulary should win later. |
| `kernel/kernel.json` (one spine) | **`harness/manifest.json`** (registry merged in, union schema) | **DEVIATES (justified).** The *substance* — one spine file, rails + full census, `additionalProperties:false` — is delivered. The existing filename was kept so every reader, test, CODEOWNERS line and doc stayed true through the merge. **Filename TBD** alongside the kernel/ question. |
| `apps/` + `_drafts/` | `apps/` + `apps/_drafts/` | **MATCHES.** Admission = census state flip + move out of `_drafts/` (rule rewritten; `drafts-path-non-candidate-state` enforced by the doctor). |
| `skills/` | seeded (`skills/README.md`), empty | **MATCHES** (design: planned concept; capture manual for now). |
| `governance/` + `checks/` | `governance/checks/` (was enforcement/), hardened fail-closed | **MATCHES.** |
| `record/`, `docs/` | unchanged | **MATCHES.** |

## Back-of-house (§5, §6)

| Design | Built | Verdict |
|---|---|---|
| `.system/releases/` — pins + sealed snapshots + `current` | Built exactly (releases 0.8–1.0; `current` symlink; immutable; rename-aside reseal) | **MATCHES** — §6a's "design-direction" sealed runtime is now REAL (cut-then-verify inside the image + final-location re-verify + hostile boot smoke). |
| `.system/sync/` (was scripts/) | Built | **MATCHES.** |
| `.system/bin/` = deleted items (Trash) | **`.system/bin/` = runtime CLIs** (os-boot, os-publish); soft-delete Trash at **`.system/trash/`** | **DEVIATES (justified).** `bin/` holding executables is the universal convention every operator expects; putting the Trash there would surprise. The Trash surface keeps every design property (§6d: move-with-metadata, restorable, purgeable, never `record/`) — only its path changed. **Trash flow itself TBD** until first real withdrawal exercises it. |
| `.system/archive/` | seeded | **MATCHES.** |
| `.system/state/` | holds the `channel` file only; **projections DB stays at root `state/`** | **TBD (deliberate, locked ruling).** Moving `state/` orphans .gitignore patterns and splits `os.db` (written by loop-store AND signal-ledger). Root `state/` is the recorded exception in structure-check's canon. Relocation = a later sequenced change. |
| `web/` → `.system/dashboard/` | **`web/` at root — pinned** | **TBD (deliberate, NN2).** Deploy-pinned at root for Vercel; relocation needs a verified re-deploy (plan §H logged future work). |
| `.claude/` at root, commands → `.system/releases/current/…`; optional `.system/claude/` symlink | Root (host requirement) ✓; hooks boot via **`os-boot.mjs` → `current`** (channel-aware — stronger than the static pointing the doc sketched); **`.claude/` now SEALED into every release** (the boot contract travels with the image; `settings.local.json` excluded). Symlink not created. | **MATCHES+** (symlink cosmetic, skipped — **TBD**). |

## Boot legibility (§6b)

| Design ask | Built | Verdict |
|---|---|---|
| SessionStart boot-check + `🖥` banner | **Wired at 1.0**: `SessionStart` hook runs `os-publish.mjs --boot-check` → `🖥 OS v1.0 booted · channel current · N components · <sha>`; loud refusal on stale/missing snapshot | **MATCHES.** |
| Statusline shows the running version every turn | 🔁 trace carries `v<version>`; statusline boots from the sealed image | **MATCHES.** |
| Turn-one 🔁 proves the hook fired | Live-fired post-adoption (signal #108 ran sealed, v0.21) | **MATCHES.** |
| Boot attestation row to `record/` on SessionStart | Not built | **TBD** — needs a small SessionStart writer + reconciler check; logged. |
| Honest limit: host-honored convention, absence visible | Documented (README, OS-CONTENTS) | **MATCHES.** |

## Version model (§4a)

Three scopes exist (component semver · harness generation.release · architectureVersion 2.0)
and the pins/tags/doctor mandate enforce them — **MATCHES** structurally. **One conflation,
TBD:** the doc wants OS-version and harness-version to move independently (Safari-update ⇒ new
macOS, same Darwin). Today `harnessVersion` doubles as the OS release id (every cut bumps it,
apps included). Splitting them means a second version field + pin surface — deferred until app
churn actually outpaces kernel churn. Justification: with 0 admitted apps, the split would be
bookkeeping with no discriminating power yet.

## Memory (§4), resource accounting (§8)

Planned in the design, absent in the build — **MATCHES the design's own honesty** (its §8 lists
both as gaps; plan §H logs them as future work). No TBD markers needed in-tree: `record/` and
`MEMORY.md` remain the substrate.

## §9 open decisions — now answered

1. Naming: **harness kept** (term + folder); `kernel/` rename = open TBD above.
2. Collapsed subsystem model: **adopted** (type is a field; five near-empty type-folders gone).
3. Bin scope: **components + versions + docs** — via `.system/trash/` (soft-delete) and
   `.system/archive/` (retire); old releases live in `releases/` (the time-machine), never archive.
4. Sequencing: **migration before admission** — executed exactly so (P0–P4, zero admissions).

## Definition-of-done check (2026-07-02)

- **A Claude Code session starts with the core harness running:** `.claude/settings.json`
  (tracked → any fresh checkout) boots statusLine + UserPromptSubmit from the sealed image;
  SessionStart prints the boot banner; verified on a fresh clone (see release 1.0 evidence).
- **Signal extractor · classifier · orchestrator · loop · guards · tracing work:** each is a
  battery-enforced eval (F1–F4 the loop end-to-end; C1/C2/W1 confinement; X1/W2 harness-lock;
  O1a/O2 tracing + completeness) — 243/243 green under lockdown, plus the live #108 trace.
- **Explicit inclusion list:** [`docs/OS-CONTENTS.md`](../OS-CONTENTS.md) (the rule) +
  `.system/releases/current/FILES.txt` + `SNAPSHOT.json.files[]` (the exact machine-generated
  list per release) + the 57-row census in the spine manifest (enforced census ↔ disk).
