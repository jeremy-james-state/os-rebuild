# hooks/ — lifecycle-event handlers

**Type folder.** A component here is a **hook**: it runs on a lifecycle event (fires:
`event`) — `SessionStart`, `UserPromptSubmit`, `PreToolUse`, git `pre-push`. The
pre-push gate, session-start, capture, away-gate and approve hooks live here.

- `hook` means a lifecycle hook (not React).
- Folders are **types**, never maturity — promotion `state` is a field in
  `../manifest.json`, not a directory.
- Each real component = a directory with `index.mjs` (or the platform-required entry)
  + co-located `contract.json` + `overview.md`.
