-- osr_loop_events — the version-stamped hosted projection the Vercel dashboard reads.
-- NEW table (a superset of osr_events, plus harness_version / component_version): it does not
-- touch osr_events or any existing table conceptually — we are moving to this version-stamped
-- version. Applied to Supabase project work-tracker (pirwnoingtczdamdirqw).
-- RLS: public read (anon + authenticated); writes via service role only.
-- Truth lives in record/*.jsonl (git); this is a rebuildable projection of state/os.db.

create table if not exists public.osr_loop_events (
  id text primary key,
  stream text not null,
  n integer not null,
  ts timestamptz,
  kind text,
  status text,
  summary text,
  trace_id text,
  span_id text,
  parent_span_id text,
  session text,
  run text,
  call integer,
  branch text,
  harness_version text,
  component_version text,
  payload jsonb,
  synced_at timestamptz not null default now()
);

alter table public.osr_loop_events enable row level security;

drop policy if exists osr_loop_events_public_read on public.osr_loop_events;
create policy osr_loop_events_public_read
  on public.osr_loop_events for select to anon, authenticated using (true);

create index if not exists osr_loop_events_stream_ts_idx on public.osr_loop_events (stream, ts);
