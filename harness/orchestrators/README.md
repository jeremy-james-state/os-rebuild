# orchestrators/ — loops that schedule + dispatch

**Type folder.** A component here is an **orchestrator**: a loop that schedules work
and dispatches it to other components (fires: `loop`). The router, the build/pipeline
coordinators, and the away-work runner live here.

- Folders are **types**, never maturity — promotion `state`
  (`production|staging|sandbox|planned|quarantined|retired`) is a field in
  `../manifest.json`, not a directory.
- Each real component = a directory with `index.mjs` + co-located `contract.json` +
  `overview.md`. (`planned` components are manifest rows only until promoted.)
