# skills/ — captured, reusable procedures (the OS's runbooks)

A **skill** is a captured, reusable method: the steps/commands that worked plus when to use
it, saved once from a successful run, versioned, recalled and reapplied later. Apps *do*
work; skills are learned recipes for *how* (a skill may call apps). The OS owns them here;
the host surfaces them via `.claude/skills/` (and `.claude/commands/`).

A new skill bumps the **OS** release, not the harness version (the kernel didn't change).

Empty at the os-reshape P1 seed — capture is manual for now (automatic capture is logged
future work, plan §H).
