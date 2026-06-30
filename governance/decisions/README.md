# decisions/ — the normative design decisions that bind behaviour

- [`layered-architecture.md`](layered-architecture.md) — **the capstone map:** three layers (governance · execution · data), two gates, one loop; every decision below is a detail page under it.
- [`authority.md`](authority.md) — capability, grants, escalation, and approval flow.
- [`component-model.md`](component-model.md) — the registered component shape for the harness.
- [`data-layer.md`](data-layer.md) — the normative traceability and record substrate.
- [`enforcement-points.md`](enforcement-points.md) — **what the harness *is*:** governance + its two enforcement points (the commit gate + the table-scoped write hooks). Gate #2 specified, not yet built.
- [`governability.md`](governability.md) — the admission test for anything claiming to govern.
- [`identity.md`](identity.md) — the governed write-identity model.
- [`manifest-registry.md`](manifest-registry.md) — the system of record split: `registry.json` rows + `manifest.json` rails, merged.
- [`platform-home.md`](platform-home.md) — **OPEN:** GitHub = governance backbone; the runtime/Data-Layer home is TBD (decide when forming the Data Layer).
- [`repo-structure.md`](repo-structure.md) — canonical top-level schema and enforcement placement.
- [`self-governance.md`](self-governance.md) — the rule that governance is checked too.
- [`write-zones.md`](write-zones.md) — one owner per path authority zone.
