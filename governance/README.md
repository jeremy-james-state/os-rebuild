# governance/ — the law the harness enforces

**Not the harness.** This is policy *data* the harness reads and enforces; it does
not execute. (Test: it doesn't run → it's outside `harness/`.)

| Folder | What |
|---|---|
| `rules/` | The rules/policies the harness enforces. Each: statement + owner + enforcement mechanism (or `pending`). The "rules folder." |
| `agents/` | Agent definitions as data (role, prompt, lifecycle) — distinct from the runner code in `harness/`. |
| `design/` | Design decisions / ADRs / specs that bind behaviour. |
| `permissions.json` | Capability grants the harness enforces. |

Changes here ride the **governance pipeline** (`docs/GOVERNANCE-PIPELINE.md`):
propose → review → decide (human) → apply → log to `record/governance-ledger.jsonl`.
