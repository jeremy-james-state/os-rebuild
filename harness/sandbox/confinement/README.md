# confinement — CANDIDATE (not admitted)

A **PreToolUse fence** that keeps a session scoped to `os-rebuild`. It answers "how do we make
sure it only operates on the os-rebuild folder" — the interpreter-level preventive tier,
modeled on the harness Core's write-fence.

```
you type a command → Claude wants to run a tool → PreToolUse fence inspects the target
        ↳ target inside ~/Projects but outside os-rebuild (a sibling like /Projects/harness)?  → BLOCK (exit 2)
        ↳ in-repo, or a system path (node, git, /usr, ~/.claude)?                               → allow (exit 0)
```

```sh
# the screenshot case — blocked:
printf '{"tool_name":"Bash","tool_input":{"command":"cd /Users/jeremyjames/Projects/harness; node --test …"}}' \
  | node index.mjs        # ⛔ Blocked Bash targeting a sibling project  (exit 2)
# in-repo — allowed:
printf '{"tool_name":"Bash","tool_input":{"command":"node --test harness/sandbox/tracer/tracer.test.mjs"}}' \
  | node index.mjs        # (exit 0)
```

- **Blocks** reads/writes/`cd` into sibling projects (`/Projects/harness`, `/Projects/OS`, …).
- **Allows** in-repo work and system paths (so node/git/tests still run).
- **Fail-open** — an unparseable payload or any error never blocks, so it can't wedge a session.
- Catches absolute Projects paths *and* relative `../` escapes.

## Two things to know

1. **Precondition:** this only loads when the session is **rooted in `os-rebuild`** (that's how
   `.claude/settings.json` hooks load). Open this folder as the project.
2. **This is the preventive tier.** A determined subprocess could still bypass an
   interpreter-level hook. The bypass-proof guarantee (reads too) is a **kernel sandbox** —
   your Core's `claude-safe` / `harness.sb` (`sandbox-exec`). If you want, I can port that too.

Wired as `PreToolUse` in [`.claude/settings.json`](../../../.claude/settings.json). Tests:
`confinement.test.mjs`.
