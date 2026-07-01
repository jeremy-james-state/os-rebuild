# .system/ — back-of-house machinery

Rarely touched by hand; nothing here is a daily concept. The six front-of-house concepts
are `harness · apps · skills · governance · record · docs`.

| Dir | Is |
|---|---|
| `releases/` | version pins (`<v>.json`) and, from P2, sealed runtime snapshots (`<v>/` + `current`) |
| `sync/` | observability sync + data-lock tooling (was `scripts/`) |
| `bin/` | the runtime CLIs: `os-publish.mjs` (seal/verify/boot-check) + `os-boot.mjs` (the stable launcher) |
| `trash/` | deleted items (soft-delete with metadata, restorable, purgeable) |
| `archive/` | retired-on-purpose things kept for the record (never auto-purged) |
| `state/` | reserved for the file-backed channel pointer (P3); the projections DB stays at root `state/` for now (relocation deferred) |

Pinned at root (NOT here, by host/deploy requirement): `.claude/`, `.github/`, `web/`,
`state/`, and `harness/render.mjs`.
