# Decision: The Identity Model

> Who GitHub sees acting, **and how the harness writes to the repo.** Three distinct
> identities — the human governs, the App (Claude) acts, CI checks — and **the App is
> the single governed write-identity for the whole harness.** Normative. Closes the
> bypass gap and is the GitHub-layer enforcement of `write-zones.md` + `authority.md`.

## The three identities

| Identity | Role | GitHub mechanism | Permissions |
|---|---|---|---|
| **Human (Jeremy)** | **Governor** — final authority, approvals, admin | personal account | **admin** + required reviewer |
| **Claude / the harness** | **Actor** — commits, branches, PRs as `claude[bot]` | **GitHub App** | **scoped write, non-admin** (contents + pull-requests) |
| **CI / `doctor`** | **Checker** — the required status check | GitHub Actions | check-only |

## Primary: a GitHub App is the actor (the standard)

The actor that writes to the repo is a **GitHub App** — scoped permissions,
**short-lived tokens**, its own `claude[bot]` identity. This is the GitHub standard
(`github-actions[bot]`, `dependabot[bot]` are Apps), and it is what *binds* the actor:
the App is **non-admin**, so rulesets apply to it with **no bypass** (the gap that let
the session through the branch ruleset — *a control that exempts the identity the agent
uses is not a control* — closes here).

## The platform constraint, and what follows

An interactive Claude Code **web session can only act as the connecting (human)
account** — the App cannot be the actor *inside* a session. So choosing the App means
**authoritative repo writes flow through the App's path — GitHub Actions /
`claude-code-action`, as `claude[bot]`** — while the **web session plans, converses, and
*triggers*** the App rather than committing directly.

| Step | Who | Identity shown |
|---|---|---|
| explore / plan / decide | web session | human (you) |
| **write to the repo** (commit · branch · PR) | the App, via Actions | **`claude[bot]`** |
| approve / merge | you | human governor |

## The long-term payoff: the App is the harness's governed write-identity

Bigger than attribution. The App becomes the **one write-channel for every agent in the
harness**:

- **Capability = a token, not a claim.** The App's installation permissions are the
  harness's **capability ceiling** at GitHub's edge. An agent physically cannot write
  outside what its token grants — `authority.md`'s "capability" made real.
- **Per-agent / per-run scoping.** Down-scoped, short-lived tokens
  (`create-github-app-token`) minted per agent or per run → each agent's write authority
  is **bounded** and each write is **attributable** to an agent + run (the four-tuple).
  This is the GitHub-layer enforcement of `write-zones.md`.
- **Observable by construction.** Every harness write is an Actions run — logged, with a
  run id — so the closed loop (signal → … → outcome) reaches the repo boundary.
- **The human stays governor.** Admin + required review; the App never gets admin.

One move, three wins: **attribution, capability-enforcement, and traceability** in a
single scoped, non-admin identity.

## Why the platform default acts "as you" — and why we step off it

Not a platform limitation to resent — a deliberate model, and understanding it is why
our choice is right.

- **Author ≠ actor.** Claude Code (web) *authors* commits as `Claude <noreply@anthropic.com>`
  with a `Claude-Session:` link — the author is visible. What shows the human is the
  **actor** of the push / PR / merge, because the session acts with the human's access.
  So the default isn't identity-less; it splits a visible author (Claude) from the actor (you).
- **The web app's model is "tool extends you"** — like an IDE or local `git`: it acts with
  exactly your permissions, nothing extra. Zero setup, your accountability, your review
  flows inherited. For an **assistant**, that's the *right* default — you wouldn't want a
  pair-programmer to need its own admin identity.
- **The bot model (this decision) is "autonomous bounded actor"** — a distinct, scoped,
  non-admin identity. Right for a **governed agent**, where you must see agent-vs-human and
  the agent must *not* hold your admin. Anthropic ships **both** on purpose; a harness needs
  the second. Our unease at "it looks like I wrote it" was the correct signal to step off
  the default onto the App.
- **The default is a connection choice, not a wall.** A web session acts as *whatever
  account is connected* (default: you); connecting a bot account would make the session
  itself act as a bot. We chose the Actions/App path instead because scoped, short-lived,
  per-agent tokens are the better foundation for *many* agents — see *Fallback*.

## Fallback (only if needed)

A dedicated **non-admin machine account** (PAT) — used *only* if a web session must write
directly without the Actions path. Weaker: long-lived token, no secrets store (visible to
env editors), a "fake human." Not the destination.

## Caveats

- **No dedicated secrets store yet** in the web env — keep any token minimal + short-lived.
- **Default-App commits don't trigger Actions** — a custom App token (`create-github-app-token`) is needed if CI must run on the App's commits.
- The App must be created/installed and granted scoped **non-admin** permissions — the human's setup.

## Status

- **Defined:** this decision (App **primary**; machine account fallback).
- **Wiring is the human's:** create/install the App, scope it non-admin, route writes
  through Actions. The session cannot switch its own auth.
- **Enforced when:** the App (non-admin) is the writer **and** required review is on —
  then rulesets bind the actor and approvals are real.

**Owner:** governance. **Basis:** decided 2026-06-30; sources: `code.claude.com` (web
auth = connecting account; Actions = App/`claude[bot]`), `anthropics/claude-code-action`
(`create-github-app-token`). Cross-refs: `authority.md`, `write-zones.md`. Ledger
`gov-2026-06-30-018`.
