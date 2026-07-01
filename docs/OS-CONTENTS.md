# OS contents — which workbench files ARE the OS

> The definitive inclusion rule + where to see the exact per-release list.
> Established at release 1.0 (the first official release, 2026-07-02).

## The rule

A workbench file is **part of the booted OS** iff it is inside the publish **closure**
(`CLOSURE` in [`.system/bin/os-publish.mjs`](../.system/bin/os-publish.mjs)):

| Included (sealed into every release) | Why |
|---|---|
| `harness/` — loop/ (signal extractor · classifier · estimator · orchestrator · tracer · loop-store · reconciler · signal-ledger · router) + guard/ (confinement · harness-lock) + `manifest.json` (spine) + schemas + `render.mjs` + generated md | the kernel |
| `apps/` — userland incl. `_drafts/` candidates | the census inside the image must resolve; the workers the kernel routes to |
| `governance/checks/` — doctor · governance-check · structure-check · no-ghost-agent · schema-validate | the doctor dependency chain; cut-then-verify runs INSIDE the image |
| `.claude/` — settings.json (hooks/statusLine) + commands + skills | the HOST WIRING: the boot contract travels with the release (`settings.local.json` excluded — machine-local) |
| `.system/bin/` — os-publish · os-boot | the publisher + the stable launcher |
| `.system/releases/<v>.json` | the release's own version pin |

**Excluded from the image** (with reason):
`*.test.mjs` (tests exercise the workbench) · `record/` + `state/` (the data layer is written
every turn — stays external, launcher wires it in via env) · `web/` (the dashboard is a
deploy-pinned view over the data layer, not runtime) · `docs/` + `governance/` prose (the
manual and the law govern the workbench; the checks are the enforced subset and ARE sealed) ·
`.github/` (CI runs on the workbench) · `.system/sync/` (observability tooling, machine-wired).

## The exact list, per release (machine-generated — never hand-maintained)

Every sealed release carries its own inventory, written at publish time:

- `.system/releases/<v>/FILES.txt` — one path per line, sorted
- `.system/releases/<v>/SNAPSHOT.json` — `{ version, sealedAt, fileCount, files[] }`

`current` is a symlink to the booted release, so **the running OS's file list is always**
`.system/releases/current/FILES.txt`. The census (`harness/manifest.json` `components[]`,
57 rows) states each component's path, state, and version; the doctor enforces census ↔ disk.

## How a session boots it

`.claude/settings.json` → `node .system/bin/os-boot.mjs session-feedback|statusline` →
resolves `.system/state/channel` (default `current`) → runs the hook **from the sealed
image**, with `record/`+`state/` wired to the workbench. Verify any time:
`node .system/bin/os-publish.mjs --boot-check` → `🖥 OS v<v> booted · channel current · …`.
