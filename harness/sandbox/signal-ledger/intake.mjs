#!/usr/bin/env node
/**
 * intake — CANDIDATE hook handler (harness/sandbox/). Wired in .claude/settings.json so it fires
 * on every run within Claude. Reads the hook payload from stdin, filters system-injected turns,
 * and appends ONE four-tuple-stamped signal to record/signals.jsonl.
 *
 * CAPTURE-ONLY: it does NOT commit or push. record/signals.jsonl is gitignored (a runtime stream
 * whose durable home is the Data Layer, per the record/ policy), so the append is a quiet local
 * write — no per-turn commit, no push, no Stop-hook nag, no PR pollution. Reaching the Data Layer
 * (Supabase) is the Data Layer's job once it is formed; git-push-as-transport was a stopgap and is
 * retired. Silent + FAIL-OPEN: a capture layer must never block a turn; exit is always 0.
 */
import { appendSignal } from './ledger.mjs'
import { isRealInput } from './filter.mjs'

async function readStdin() {
  let s = ''
  try { for await (const c of process.stdin) s += c } catch { /* no stdin */ }
  return s
}

const raw = await readStdin()
let payload = {}
try { payload = JSON.parse(raw) || {} } catch { /* non-JSON or empty */ }

// Only REAL inputs become signals; system-injected turns are dropped.
if (!isRealInput(payload)) process.exit(0)

const source = payload.hook_event_name || 'UserPromptSubmit'
const summary = typeof payload.prompt === 'string' && payload.prompt
  ? payload.prompt
  : (payload.tool_name ? `tool:${payload.tool_name}` : source)

try {
  appendSignal({ session: payload.session_id ?? null, source, summary }) // append only — never commit/push
} catch { /* fail open: capture must never block a turn; appendSignal already logged any drop */ }

process.exit(0)
