# Controls Register — what's actually governing us, and who owns it

> Retrace + full inventory of every control acting on this work, grounded in the
> files on disk (2026-06-30). Purpose: stop being surprised by undocumented
> controls. This is the environment/governance half of the harness boundary —
> the part that lives *outside* the repo.

**Machine-readable twin:** `governance/environment.json` is the structured registry
of every control below — the file a future env-audit will check the way the doctor
checks the harness. This page is the prose; that file is the inventory.

**Live audit (2026-06-30, this container):** the OS v2 repo defines **no hooks,
no `.mcp.json`, no `.claude` settings of its own.** The only hooks running are the
two host-injected ones (Layer 1). The pre-push laws / away-gate / capture-hook you
remember **live only in the legacy local Mac checkout and do not fire here.** The
OS v2 control set is a deliberate choice still to be made — not an inheritance to
untangle.

**Key finding:** the friction in this session came from **three layers** with
**three different owners**. Only Layer 3 is yours and in-repo. Layers 1–2 are the
platform and the environment — which is exactly why they were invisible.

---

## Layer 1 — Claude Code web platform (CCR) defaults — NOT yours, not in-repo

Live in `~/.claude/` on the container; wired by `~/.claude/launcher-settings.json`.
These ship with the web runtime; you didn't add them and can't easily change them.

| Control | Hook | What it does | Can you change it? |
|---|---|---|---|
| `session-start-git-identity.sh` | SessionStart | Pins git committer to `Claude <noreply@anthropic.com>`; sets `core.hooksPath=~/.ccr-git-hooks` with co-author trailer + passthrough stubs | No (platform) |
| `stop-hook-git-check.sh` | Stop | Blocks turn-end (exit 2) unless the tree is **committed AND pushed AND signature-verified** | No (platform) |
| `stop-hook-reply-gate.py` | Stop | Reply quality/format gate | No (platform) |
| `user-prompt-submit-reply-reminder.py` | UserPromptSubmit | Reply reminder | No (platform) |

**Two consequences that bit us:**
1. The "commit and push" / "Unverified commit" nags are **unavoidable in a web
   session** whenever we work locally without pushing. The hook only goes quiet
   when there's nothing uncommitted, untracked, *or* unpushed — impossible while we
   deliberately hold pushes. The nag is benign; it does not mean I should push.
2. **CCR sets `core.hooksPath=~/.ccr-git-hooks`**, whose passthrough stubs chain to
   `$GIT_DIR/hooks/<name>` — **not** to the repo's `.githooks/`. So the repo's
   managed `pre-push` law (`decision-enforcer`) **does not fire in a cloud session**.
   This is the concrete mechanism behind the earlier finding that "the laws may not
   fire in cloud." The platform's hook path supersedes the repo's.

## Layer 2 — Remote environment configuration — partly yours, set at env creation

| Control | What it does | Owner / change path |
|---|---|---|
| GitHub access scope = `jeremy-james-state/os` only | Blocks reading/writing other repos; **blocks creating new repos** (`403 / 404`) — this is why I couldn't create `OS` | Environment GitHub integration (fine-grained, single-repo). You reconfigure it |
| Network policy | Outbound HTTPS only via the agent proxy | Environment setting |
| Branch development constraint | Develop on `claude/harness-schema-governance-esux5d`; push only there | Session/task setup |
| Bash allow/deny (`rm -rf`, `git push --force`, `git reset --hard` denied, etc.) | Guards destructive commands | Task git-ops rules + `claude-global-settings.json` (sample) |

## Layer 3 — Repo-level controls — yours, in-repo, version-controlled

The ones already inventoried in `harness/manifest.json` (governance section):
`.githooks/pre-push` + `decision-enforcer` (9 laws), `away-gate`, `capture-hook`,
the repo `session-start-hook`, `template-conformance`, `chain-state-attest`,
`CODEOWNERS`. **These are the only controls we can fully govern from the repo** —
and per Layer 1, some don't even fire in cloud.

---

## What this means for "reinstate controls + governance"

1. **You can't govern Layers 1–2 from inside the repo** — but you *can* document
   them (this file) so they stop surprising us, and decide which Layer-2 settings
   you actually want (e.g., widen GitHub scope to the new `OS` repo; keep network
   policy).
2. **The repo's own laws (Layer 3) must not assume they're the only guard** — in
   cloud they may be bypassed by Layer 1. Real enforcement that can't be bypassed
   has to live at the **GitHub platform** (branch protection on `master`), not only
   in local hooks.
3. **The push friction has a cleaner resolution than "never push."** The platform
   *expects* web sessions to push to a session branch. The thing that actually needs
   control is the **merge to `master`** and the **repo destination** — not the push
   itself. My earlier push felt wrong because the *destination repo* wasn't agreed,
   not because pushing a disposable session branch is wrong.

## Recommended model (sustainable, ends the friction)

- **Push freely to disposable session branches** (`claude/...`). This satisfies the
  platform and preserves work in the ephemeral container.
- **Protect `master`** on the new `OS` repo: PR required, review required, status
  checks (doctor + tests), no force-push, CODEOWNERS on `harness/`. Control lives
  at the merge, where it can't be bypassed.
- **Document Layers 1–2 here** and keep this register beside `HARNESS-CHARTER.md`.
- **The doctor** (Layer 3) stays the in-repo drift-check, with the honest caveat
  that platform branch protection is the non-bypassable backstop.

## Clean slate?

Not needed to *document* controls — that's just writing. The clean slate is the new
`OS` repo we already agreed on. The new insight: when we reinstate controls there,
we **deliberately re-choose** the Layer-3 set (rather than auto-carrying the
accreted 9 laws), **document** Layers 1–2 in this register, and put the real
backstop on **GitHub branch protection**. Governance becomes chosen and visible,
not accreted and invisible.
