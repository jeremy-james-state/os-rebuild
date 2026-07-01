#!/usr/bin/env bash
# setup-local-sync.sh — keep the Vercel dashboard fresh, automatically, from THIS machine.
#
# WHY LOCAL (not CI): the loop data (record/*.jsonl) is gitignored — it lives only on this
# machine, never in git — so the sync must run where the data is. A GitHub Actions job would
# check out a repo with no loop data and have nothing to push.
#
# What this installs: a launchd job that runs .system/sync/sync-supabase.mjs every 30 minutes.
# That script reads the Supabase service key from $OS_SUPABASE_KEY OR the gitignored file
# <repo>/.supabase-key; with no key it skips harmlessly (so it's safe to install before you
# have a key). Drop the key in .supabase-key and the dashboard starts staying fresh on its own.
#
#   Install/refresh:  bash .system/sync/setup-local-sync.sh
#   Stop:             launchctl unload ~/Library/LaunchAgents/com.osr.dashboard-sync.plist
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
NODE="$(command -v node)"
LABEL="com.osr.dashboard-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$REPO/state/dashboard-sync.log"
mkdir -p "$HOME/Library/LaunchAgents" "$REPO/state"

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${NODE}</string><string>${REPO}/.system/sync/sync-supabase.mjs</string></array>
  <key>StartInterval</key><integer>1800</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict></plist>
PLIST_EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "installed + loaded: ${LABEL} — syncs every 30 min. log: ${LOG}"
echo "→ drop your Supabase service key into ${REPO}/.supabase-key (gitignored); until then the sync skips."
