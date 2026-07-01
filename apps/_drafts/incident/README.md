# incident — what it does

**Files and tracks incidents — the OS's "something went wrong" paper trail.** Run via
`/incident`. It creates one structured incident file under `record/incidents/` (what
happened, evidence, root cause, the five remediation steps), keeps the log index current,
and is the surface the reconciler raises into when it finds a signal that never got an
outcome. The `/incident` command can dispatch the investigator app to fill the file with
an evidence-based root cause. Deterministic spine: location, shape, and idempotency are
guaranteed by code.

Status: candidate (`apps/_drafts/`), not admitted. Tests: `incident.test.mjs`.
