# services/ — always-up processes

**Type folder.** A component here is a **service**: a long-lived process that responds
to events or requests (fires: `event`/`request`). The local-tracker server, the event
store, and the context-window monitor live here. A service that owns a table is a
**store** (sole writer).

- Folders are **types**, never maturity — promotion `state` is a field in
  `../manifest.json`, not a directory.
- Each real component = a directory with `index.mjs` + co-located `contract.json` +
  `overview.md`.
