-- osr_events — the hosted projection the Vercel dashboard reads.
-- Applied to Supabase project work-tracker (pirwnoingtczdamdirqw). NEW, prefixed table —
-- it does not touch any existing table. RLS: public read; writes via service role only.
-- Truth lives in record/*.jsonl (git); this is a rebuildable projection of state/os.db.

create table if not exists public.osr_events (
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
  payload jsonb,
  synced_at timestamptz not null default now()
);

alter table public.osr_events enable row level security;

drop policy if exists osr_events_public_read on public.osr_events;
create policy osr_events_public_read
  on public.osr_events for select to anon, authenticated using (true);

create index if not exists osr_events_stream_ts_idx on public.osr_events (stream, ts);
