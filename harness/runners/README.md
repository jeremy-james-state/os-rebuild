# runners/ — one-shot executors

**Type folder.** A component here is a **runner**: it runs to an `exit` (fires: `once`
or `request`). An **agent** is a runner an orchestrator dispatches (LLM); a **command**
is a runner triggered by request; a **query** is a runner that writes nothing. The
clarifier, scoper, planner, executor, tester and the governance gates live here.

- Folders are **types**, never maturity — promotion `state` is a field in
  `../manifest.json`, not a directory.
- Each real component = a directory with `index.mjs` + co-located `contract.json` +
  `overview.md`.
