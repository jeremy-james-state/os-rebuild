# scripts/

Operational scripts (not harness components — infrastructure around the repo).

## `data-lock.mjs` — protect the append-only `record/` data

Make the tracked evidence (`governance-ledger.jsonl`, `incidents/**`, `handoffs/**`,
`SCHEMA.md`) **provably un-overwritable** while risky work runs, then restore it.

```sh
node scripts/data-lock.mjs lock      # snapshot + backup + chflags uchg + chmod 0444, then PROVE it
node scripts/data-lock.mjs verify    # re-checksum vs baseline → identical or DRIFT
node scripts/data-lock.mjs unlock    # release (data is appendable again)
```

Uses `chflags uchg` (macOS user-immutable: blocks overwrite, append, rename **and delete**
— `chmod a-w` alone does not stop `rm`). `lock` self-proves the mechanism on a scratch probe
before reporting success. Snapshots/backups land in `state/data-lock/` (gitignored). Tested:
`data-lock.test.mjs`.

## `sync-supabase.mjs` — push the data layer to the hosted projection

Upserts `record/*.jsonl` (via loop-store) into Supabase `public.osr_events` that the Vercel
dashboard reads. Needs a service key at runtime (never committed):

```sh
OS_SUPABASE_KEY=… node scripts/sync-supabase.mjs
```

`osr_events.schema.sql` is the table DDL (new prefixed table; existing data untouched).
