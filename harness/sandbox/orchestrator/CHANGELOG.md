# orchestrator — changelog (generated)

> Generated from `harness/registry.json` by `harness/render.mjs`.
> Do not edit by hand — edit the JSON and run `node harness/render.mjs --changelogs`.

| Version | Date | Change |
| --- | --- | --- |
| 0.1.0 | 2026-07-01 | Initial version (seeded at P1-a). |
| 0.1.1 | 2026-07-01 | Raise doctor-dispatch spawnSync timeout 5s→30s — the 5s fail-open guard cut off a legitimate 1–7s doctor under load (flaky os: block decision). |
