# confinement — changelog (generated)

> Generated from `harness/manifest.json` by `harness/render.mjs`.
> Do not edit by hand — edit the JSON and run `node harness/render.mjs --changelogs`.

| Version | Date | Change |
| --- | --- | --- |
| 0.1.0 | 2026-07-01 | Initial version (seeded at P1-a). |
| 0.2.0 | 2026-07-01 | Add dormant fail-closed decideStrict allowlist + Tier-1 harness.sb (live decide() unchanged). |
| 0.3.0 | 2026-07-01 | Make forbidden/targets/decide injectable via optional {root,home} so tests are hermetic (no dependency on ambient HOME / checkout location); live main() + decideStrict unchanged, defaults preserve behavior. |
| 0.3.1 | 2026-07-01 | os-reshape P1: relocated to harness/guard/confinement/ (in-place reshape; behaviour unchanged unless noted in the P1 ledger entry gov-2026-07-01-043). |
