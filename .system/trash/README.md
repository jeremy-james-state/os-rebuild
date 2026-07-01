# .system/trash/ — deleted items (soft-delete)

*"Removed — undo if wrong."* Withdrawing an app/skill/doc MOVES it here with metadata
(what / when / why / origin) and a one-step restore. Transient and **purgeable** — the
Trash, not the archive (`.system/archive/` = retired on purpose, kept). Never holds
`record/` content: the ledger is immutable evidence.

> Naming note (architecture conformance review, 2026-07-02): the design spec placed this
> role at `.system/bin/`; `bin/` universally means executables (and holds os-boot/os-publish),
> so the Trash lives here. Flow marked **TBD** until the first real withdrawal exercises it.
