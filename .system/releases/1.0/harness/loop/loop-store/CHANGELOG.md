# loop-store — changelog (generated)

> Generated from `harness/manifest.json` by `harness/render.mjs`.
> Do not edit by hand — edit the JSON and run `node harness/render.mjs --changelogs`.

| Version | Date | Change |
| --- | --- | --- |
| 0.1.0 | 2026-07-01 | Initial version (seeded at P1-a). |
| 0.1.1 | 2026-07-01 | os-reshape P1: relocated to harness/loop/loop-store/ (in-place reshape; behaviour unchanged unless noted in the P1 ledger entry gov-2026-07-01-043). |
| 0.1.2 | 2026-07-01 | os-reshape P2: OS_ROOT boot-root indirection (explicit runtime root for sealed/launcher boots; default file-relative derivation unchanged). |
| 0.1.3 | 2026-07-01 | os-reshape P3: live-holder locks are NEVER stolen (dead/stale-only break); a live lock outlasting the wait budget FAILS CLOSED with a loud drop record (X2b). |
