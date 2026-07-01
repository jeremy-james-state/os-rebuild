# reshape-rig — CANDIDATE (not admitted)

The migration test rig for the **os-reshape execution plan**
([`docs/superpowers/specs/2026-07-01-os-reshape-execution-plan.md`](../../../docs/superpowers/specs/2026-07-01-os-reshape-execution-plan.md)).
It makes every §D2 eval an executable, deterministic pass/fail.

| File | Is |
|---|---|
| `rig.mjs` | shared helpers (hermetic env, repo copies, normalizer) + the eval catalogue (F/C/G/O) |
| `capture.mjs` | golden-master capture (`--write`) + the F5 equivalence gate (`--check`) |
| `golden-master.json` | pinned pre-reshape behaviour (normalized); committed evidence |
| `reshape-rig.test.mjs` | the battery as `node:test` — CI picks it up via the existing glob |
| `grep-gate.mjs` | scoped stale-path gate; PATTERNS filled at P1 with the move map |
| `x-writer.mjs` | child writer for the X2 multi-writer completeness rig |
| `rollback-drill.mjs` | R1 — executable at P4 once the adoption commit exists |

**RED-first convention:** tests prefixed `[P1-target]` / `[P2-target]` / `[P3-target]`
assert the *hardened or not-yet-built* behaviour and are **expected to fail** until that
phase lands. The same test failing *after* its phase is a regression. CI on the
`os-reshape` branch is therefore red mid-migration **by design** — the branch merge is
gated on the full battery going green (P4).

**Hermeticity:** fault injection only ever happens inside `mkdtemp` repo copies; loop
runs redirect `OS_RECORD_DIR`/`OS_DB`/`OS_DROPS`. The rig never mutates the live tree.
