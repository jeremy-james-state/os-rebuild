# GitHub & Local — the disciplined workflow

> One source of truth, one write-path, a read-only local window. The foundation
> that lets control be surrendered safely later.

## The model

```
                 branches → PR → merge (gated)
 cloud sessions ───────────────────────────────▶  GitHub  main  (protected, source of truth)
 (Claude)                                            │
                                                     │ git pull (read-only)
                                                     ▼
                                            your Mac: local clone  ──▶  Obsidian (view)
```

## The rules

1. **GitHub `main` is the single source of truth**, and **protected**: PR + review
   required, `doctor` + tests as required status checks, no force-push, no direct
   commits — by anyone (you, me, or a cloud session).
2. **All change happens on branches → PR → merge.** Cloud sessions push session
   branches (`claude/...`); you review and merge. The governance gate is the merge.
3. **Your local clone is read-only** — your window for viewing (Obsidian). You
   `git pull` to get the latest; you do not commit locally. Every change flows
   through a branch/PR. One write-path keeps it disciplined.
4. **One writer per branch** — never a cloud session and a local edit on the same
   branch at once.
5. **The doctor runs at the merge**, so whatever reaches `main` (and therefore your
   local) is always boundary-clean.

## Viewing in Obsidian

Obsidian opens a **folder** as a vault. So:

```sh
# one-time, on your Mac:
git clone https://github.com/jeremy-james-state/OS.git
# in Obsidian: "Open folder as vault" → select the OS folder (or just OS/docs)

# whenever you want the latest:
cd OS && git pull
```

`.obsidian/` (Obsidian's per-machine view state and cache) is **gitignored** — it
stays local and never pollutes the repo. The markdown is the content; Obsidian is
just a lens over it. Backlinks and graph view work across the vault.

## Why read-only local

You asked to build on a disciplined foundation. A single write-path (branches →
PR → merge) means there is exactly one way anything changes `main`, every change is
reviewed and doctor-checked, and your local copy can never drift into being a second
unreviewed source of truth. It's the same "control at the merge" rule, extended to
your desktop. If you later want to jot notes locally, we promote that to a
read-write local on a `notes/` branch deliberately — not by default.

## Hands-off local mirror (launchd, read-only)

Set it once; it keeps a read-only mirror of `main` fresh in a folder you choose
(e.g. your Obsidian vault). `git pull --ff-only` guarantees it can never absorb a
local edit, so the mirror stays genuinely read-only. *(Set this up once `main`
exists and is protected — it tracks `main`.)*

1. One-time clone to your chosen location (use an absolute path):

   ```sh
   git clone https://github.com/jeremy-james-state/OS.git /Users/jeremyjames/Obsidian/OS
   ```

2. Save as `~/Library/LaunchAgents/com.os.mirror.plist` (absolute paths only —
   launchd does not expand `~`; check your git path with `which git`):

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0"><dict>
     <key>Label</key><string>com.os.mirror</string>
     <key>ProgramArguments</key>
     <array>
       <string>/usr/bin/git</string>
       <string>-C</string><string>/Users/jeremyjames/Obsidian/OS</string>
       <string>pull</string><string>--ff-only</string>
     </array>
     <key>StartInterval</key><integer>1800</integer>
     <key>RunAtLoad</key><true/>
     <key>StandardErrorPath</key><string>/Users/jeremyjames/Obsidian/.os-mirror.log</string>
   </dict></plist>
   ```

3. Activate it:

   ```sh
   launchctl load ~/Library/LaunchAgents/com.os.mirror.plist
   ```

Now that folder auto-updates from `main` every 30 minutes, read-only. Open it in
Obsidian (`Open folder as vault`). This becomes a proper `local-mirror` harness
component later; launchd is the hands-off start.
