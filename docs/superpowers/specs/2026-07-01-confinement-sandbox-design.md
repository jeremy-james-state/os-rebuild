# Confinement & Write-Fence Hardening — Design

- **Status:** draft spec, awaiting review
- **Date:** 2026-07-01
- **Branch:** `design/harness-version-control` (may split to its own branch on plan)
- **Related:** [`harness/sandbox/confinement/index.mjs`](../../../harness/sandbox/confinement/index.mjs) ·
  [`.claude/settings.json`](../../../.claude/settings.json) ·
  [`governance/environment.json`](../../../governance/environment.json) ·
  [`docs/CONTROLS-REGISTER.md`](../../../docs/CONTROLS-REGISTER.md) ·
  [`docs/BOUNDARY.md`](../../../docs/BOUNDARY.md)
- **Sibling principle:** "controls fail closed, observability fails open" (harness-version-control
  spec §12.1).

## 1. Finding (why this workstream exists)

The `confinement` `PreToolUse` hook is presented as keeping the session "inside os-rebuild." It does
**not** provide that guarantee. Adversarial probing of the real `decide()` (side-effect-free) showed
**8 of 10 outside-writes escape**:

| Write target | Blocked? |
|---|---|
| `~/Projects/<sibling>` (literal path) | ✅ yes |
| `/tmp`, `~/` home root, `~/.claude/settings.json`, `/etc/*` | ❌ **allowed** |
| Bash via `$VAR` indirection, `$HOME`, or `cd`-chaining to a sibling | ❌ **allowed** |
| Any `mcp__*` write tool to a sibling | ❌ **allowed** |

Root causes:
1. **Wrong shape** — it blocks only `~/Projects/<sibling>`; it is a *sibling blocklist*, not an
   *os-rebuild allowlist*. Everything outside `~/Projects` is writable.
2. **Fail-open by design** — parse error / no stdin / timeout / any exception → exit 0 (allow).
   Confirmed: garbage input → exit 0. A containment control that fails open silently permits escape.
3. **Bash = substring regex** — only a *literal* sibling path in the command is caught; variables,
   `$HOME`, and `cd`-chaining bypass it.
4. **MCP write tools uncovered** — `targets()` recognizes no `mcp__*` tool.
5. **Symlink escape** — lexical `resolve()` doesn't follow symlinks; a repo-internal symlink to a
   sibling resolves "under REPO" and passes.
6. **Root-scoped** — the hook loads from this repo's `.claude/settings.json`; another project root =
   no fence.

The hook's own docstring is honest: it is the *"interpreter-level PREVENTIVE tier"* and *"the hard
guarantee (reads too, bypass-proof) is a kernel sandbox — the Core's `claude-safe` / harness.sb."*
The gap is that nothing makes this limitation loud, so it reads as a guarantee it never was.

## 2. Goals

- A **real** filesystem-write guarantee for a session scoped to os-rebuild: deny-by-default,
  covering Bash **and** MCP **and** every tool, un-bypassable by string tricks or symlinks.
- **Fail closed** for the control tier (per the binding principle).
- **Honest declaration** — the control's true capability is registered in `environment.json` /
  `CONTROLS-REGISTER.md`, never over-claimed.

## 3. Non-goals

- Blocking reads (separate concern; the kernel profile can add it later).
- Governing the cloud/remote container (its own execution context; this targets local).

## 4. Approach — two tiers

**Tier 1 (the guarantee): kernel/OS sandbox.** Run the session under macOS `sandbox-exec` (seatbelt
`.sb` profile) or an equivalent confined user/container that permits filesystem **writes only under
the repo root** (+ required system paths: node, git, `/tmp` scratch, `~/.claude` state as needed) and
denies the rest at the **syscall** level. This is bypass-proof and tool-agnostic — it constrains
Bash and MCP identically. Mirrors the Core's `claude-safe` / `harness.sb` the docstring references.

**Tier 2 (defense-in-depth): fail-closed hook redesign.** Keep a `PreToolUse` hook as a fast,
legible second line, but corrected:
- **Allowlist semantics** — deny writes whose resolved target is **not under REPO** (not merely
  "under `~/Projects` and not REPO").
- **Fail closed** — on parse error / timeout / exception for a *write* tool, **block** (not allow).
- **Cover all write tools** — `Write`/`Edit`/`NotebookEdit` + every `mcp__*` tool with a
  path/file argument; maintain an explicit write-tool set.
- **`realpath`** the target (resolve symlinks) before the under-REPO test.
- **Stop parsing Bash for safety** — a hook cannot reliably know what a shell command writes; treat
  Bash writes as *unconstrainable at this tier* and rely on Tier 1. (The hook may still warn.)

## 5. Failure handling

- Tier-1 sandbox is the guarantee; Tier-2 hook failing closed can at worst over-block (annoying, not
  unsafe) — acceptable for a control.
- If Tier 1 is unavailable on a host, that is surfaced loudly (the session is *not* confined), never
  silently assumed.

## 6. Testing

- A red-team battery (the probe used to find this) runs as a test: every escape vector above must be
  **blocked**, including the fail-open/malformed-input case (must now block for write tools) and a
  real symlink escape.
- Tier-1 profile verified by attempting real out-of-root writes under the sandbox and asserting they
  are denied by the OS.

## 7. Governance

- The confinement control is **declared** in `environment.json` (L3_repo) with its *actual* capability
  and tier; the version-control assurance loop treats an undeclared control as drift.
- Logged as an environmental change in `record/governance-ledger.jsonl`.

## 8. Open questions

- Exact seatbelt profile + how the session is launched under it (wrapper script vs launcher setting).
- Which system paths beyond REPO must be writable (`~/.claude`, `/tmp`, caches) — enumerate minimally.
- Whether Tier 2 stays long-term or is retired once Tier 1 is trusted.
