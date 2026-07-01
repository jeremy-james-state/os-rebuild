# Resume Here — read this first

**State as of 2026-07-01 · harness `v0.13` · `main` self-governing and green.**

## What exists now (done, merged, gated)
- **Version control:** 55 components, each versioned + changelogged; releases `v0.8→v0.13`, git-tagged.
- **Self-governing merge gate:** `main` is protected by the `main-branch-governance` ruleset (PR
  required, no force-push). **CI is live + a required status check**, and **auto-merge is on** — PRs
  self-merge on green. The AI merges conforming work; the owner does not review.
- **Mandatory versioning:** `checkVersionBumpOnChange` rejects a component change with no version bump.
  16 doctor/governance checks total.
- **Observability:** Vercel dashboard reads Supabase `osr_loop_events` (version-stamped). A **local
  launchd job** (`com.osr.dashboard-sync`, every 30 min) syncs it from this machine using the key in
  the gitignored `.supabase-key`.
- **handoff** is a governed harness component (saves only to `record/handoffs/`, enforced by test+gate).

## THE ONE OPEN DECISION (carried from last session)
**Keep or remove the launchd dashboard auto-sync?** It's currently **loaded and working** (every 30
min). Keep = hands-off freshness. Remove = `launchctl unload ~/Library/LaunchAgents/com.osr.dashboard-sync.plist`
+ delete the plist; sync manually instead. No other blockers.

## Standing rules (do not violate)
- **The AI must NOT hold GitHub admin** — non-admin token only (Contents/PR/Workflows R/W). Ruleset
  edits are the owner's one-time click. A control that exempts the agent is not a control.
- **Owner is the observer, not the reviewer** — assurance via checks + dashboard, never by reading diffs.
- All harness/OS changes flow: `work/<id>` branch → PR → CI gate → auto-merge. Never direct to `main`.

## Deferred (built but not switched on)
- Concurrency: per-component write-lock + branch-discipline (dormant).
- Confinement Tier-1 kernel sandbox + Tier-2 fail-closed hook (built, dormant).
- Live version hot-swap (runtime pointer) — Phase 2, not built.
