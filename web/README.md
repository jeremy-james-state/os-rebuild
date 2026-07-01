# web/ — the observable view

A zero-build static dashboard of the signal loop, deployed on Vercel.

- **Live:** https://web-lemon-ten-15.vercel.app
- **Reads:** Supabase `public.osr_loop_events` (a version-stamped hosted projection — a
  superset of the older `osr_events` that adds `harness_version` / `component_version`) with the
  **public anon key** under RLS (select-only). Truth lives in `record/*.jsonl` in git;
  `osr_loop_events` is rebuildable.
- **Auto-refreshes** every 5s. Shows the nodes (extract → classify → estimate → route →
  outcome) with live counts, the open incidents the reconciler raised, and each signal's
  journey joined by `trace_id`.

## Data flow

```
record/<stream>.jsonl  (truth, git)
      │ node harness/sandbox/loop-store/index.mjs project
      ▼
state/os.db (readable SQLite)
      │ OS_SUPABASE_KEY=… node .system/sync/sync-supabase.mjs   (service key; writes via RLS-exempt role)
      ▼
Supabase public.osr_loop_events  (version-stamped; RLS: public read)
      │ anon key (public)
      ▼
this dashboard
```

## Deploy / refresh

```sh
vercel deploy --prod --yes --cwd web        # redeploy the static site (authed as jeremy-james-state)
OS_SUPABASE_KEY=… node .system/sync/sync-supabase.mjs   # push the latest events to the projection
```

The anon key embedded in `index.html` is a **publishable** key (read-only via RLS) — safe to
ship. Writing requires a service key supplied at sync time, never committed.
