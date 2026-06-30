# lib/ — imported plumbing

**Type folder.** A component here is a **library**: pure code imported by others, never
fired on its own. The gates (tagger, clarify-gate), the routing policy, build-templates,
verifier and the recovered OS libraries (discernment, work-model, deploy-gate,
model-runtime) live here. Libraries are zero-IO and fully testable.

- Folders are **types**, never maturity — promotion `state` is a field in
  `../manifest.json`, not a directory.
- Each real component = a directory with `index.mjs` + co-located `contract.json` +
  `overview.md`.
