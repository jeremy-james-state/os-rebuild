# Pending CI workflows

These GitHub Actions workflows are **relocated** here from `.github/workflows/` because the
token available during the autonomous rebuild lacked the `workflow` scope, so GitHub refuses
to push files under `.github/workflows/`.

They are preserved verbatim and declared in [`governance/environment.json`](../../governance/environment.json)
(L3_repo controls) as `pending`. The repo's three enforcement checks
(`doctor`, `governance-check`, `structure-check`) run locally regardless — CI here is the
*merge-time* mirror of those same checks.

## To activate (one-time, by a human with a workflow-scoped token)

```sh
git mv .github/workflows.pending .github/workflows
# revert the path/live fields for the three ci entries in governance/environment.json
#   (.github/workflows.pending/  ->  .github/workflows/ ,  "live": false -> true)
git commit -am "activate CI workflows"
git push    # requires a PAT/classic token with `workflow` scope, or the GitHub App
```

`governance-check`'s `checkDeclaredWorkflows` then validates every file in
`.github/workflows/` against the declared set — so keep the two in sync.

| Workflow | What it does |
|---|---|
| `ci.yml` | the merge gate: doctor + governance-check + structure-check + tests on every PR/push |
| `claude.yml` | `@claude` write-path via the GitHub App on issues/PRs |
| `sync-signals.yml` | dormant signal→Supabase transport (gov-031) |
