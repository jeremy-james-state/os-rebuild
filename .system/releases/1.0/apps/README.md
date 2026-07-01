# apps/ — userland: the workers the kernel routes to

One folder per app: `index.mjs` (or the app's entry) + `contract.json` + notes. A
**handler** is deterministic code (same input → same output); an **agent** is LLM-driven.
Both are apps the harness routes to.

`_drafts/` holds candidates not yet admitted (the pre-admission zone — formerly the
harness sandbox). Admission = move out of `_drafts/` + the manifest state flip, under
review (`governance/rules/harness-admission.md`). Lifecycle state lives in the manifest
census — location alone never admits.
