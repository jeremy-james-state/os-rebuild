# orchestrator — changelog (generated)

> Generated from `harness/manifest.json` by `harness/render.mjs`.
> Do not edit by hand — edit the JSON and run `node harness/render.mjs --changelogs`.

| Version | Date | Change |
| --- | --- | --- |
| 0.1.0 | 2026-07-01 | Initial version (seeded at P1-a). |
| 0.1.1 | 2026-07-01 | Raise doctor-dispatch spawnSync timeout 5s→30s — the 5s fail-open guard cut off a legitimate 1–7s doctor under load (flaky os: block decision). |
| 0.1.2 | 2026-07-01 | os-reshape P1: relocated to harness/loop/orchestrator/ (in-place reshape; behaviour unchanged unless noted in the P1 ledger entry gov-2026-07-01-043). |
| 0.1.3 | 2026-07-01 | P1 peer-review fix: doctor handler FAIL-LOUD (no fabricated clean bill on crash/empty output — eval C6) + hardened main-guard (pathToFileURL). |
