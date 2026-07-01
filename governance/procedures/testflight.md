# Procedure: testing an OS before launch (TestFlight)

> Try a beta OS without touching what sessions boot. Channels: `current` (stable) and
> `next` (beta). The launcher (`.system/bin/os-boot.mjs`) reads `.system/state/channel`.

## Steps

1. Build + gate the candidate release in the workbench (checks + full battery + grep-gate
   green — same bar as [release.md](release.md) steps 1–5).
2. **Seal to the beta channel**: `node .system/bin/os-publish.mjs --channel next` —
   full cut-then-verify runs; only the `next` pointer moves. `current` is untouched.
3. **Flip your session to beta**: write `next` into `.system/state/channel`. Every boot
   now announces itself loudly (`🧪 TestFlight: booting channel NEXT`); a `next` channel
   with nothing published REFUSES loudly (never a silent fallback).
4. **Exercise it**: real prompts (the 🔁 trace shows the beta version), plus
   `node .system/bin/os-publish.mjs --boot-check` and the battery.
5. **Promote** (atomic): republish to `current` (or repoint) and set the channel back —
   pointer swaps are atomic sibling renames; publishes are lock-serialized (X3).
   **Revert** = write `current` back into the channel file. One line either way.

Per-app beta needs no channel: candidates already run from `apps/_drafts/` — wiring a
command at a `_drafts` path IS the app's TestFlight; admission moves it to `apps/`.
