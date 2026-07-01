# reshape-rig — changelog (generated)

> Generated from `harness/manifest.json` by `harness/render.mjs`.
> Do not edit by hand — edit the JSON and run `node harness/render.mjs --changelogs`.

| Version | Date | Change |
| --- | --- | --- |
| 0.1.0 | 2026-07-01 | Initial version (P0 of the os-reshape plan: rigs + golden master + RED-first battery). |
| 0.1.1 | 2026-07-01 | M1 peer-review fixes: hermeticity (verbatim symlinks, env stripping, async timeouts, no state/ copy, retry), correctness (G6 release sort, explicit-red assertions, strict S/X predicates), coverage (G7/G8/O2/M2/W1/W2/W4, S6-S8, X2 split, functional X1, grep-gate wired, coverage table + battery baseline). |
| 0.1.2 | 2026-07-01 | os-reshape P1: relocated to apps/_drafts/reshape-rig/ (in-place reshape; behaviour unchanged unless noted in the P1 ledger entry gov-2026-07-01-043). |
| 0.1.3 | 2026-07-01 | os-reshape P2: symlink-proof CLI main-guard (cliInvoked realpath) — the silent-no-op class killed repo-wide after the sealed-boot repro. |
| 0.1.4 | 2026-07-01 | os-reshape P3 (P2 peer-review): grep-gate excludes sealed .system/releases/<v>/ — immutable history records the paths of its era. |
| 0.1.5 | 2026-07-02 | P4 evidence pack finalized (R1 drill result recorded). Doc-only; the version-bump mandate treats evidence as substantive — complying is cheaper than special-casing the control. |
