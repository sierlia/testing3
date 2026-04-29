# Gavel

## Local development

1. Install dependencies: `npm i`
2. Configure frontend env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Run app: `npm run dev`

## Supabase setup (CLI-first)

This repository is configured for Supabase project `qrtccdwxolfuuucadosa`.

### Required GitHub secrets

- `SUPABASE_ACCESS_TOKEN` (personal access token for Supabase CLI auth)
- `SUPABASE_PROJECT_ID` (`qrtccdwxolfuuucadosa`)
- `VITE_SUPABASE_URL` (for frontend deployment environment)
- `VITE_SUPABASE_ANON_KEY` (publishable key; current value provided by owner: `sb_publishable_6hAYQ0LqZrMutVFoAb8hzQ_8kbPpnQY`)

> Never put the service role key in frontend code or public client bundles.

### Local migration workflow

```bash
supabase login
supabase link --project-ref qrtccdwxolfuuucadosa
supabase db push
```

- All schema changes must be committed as SQL files in `supabase/migrations/`.
- Do **not** run destructive migrations unless explicitly marked and documented in the PR.

### Deployment workflow

On pushes to `main` that change migration files, GitHub Actions runs `.github/workflows/supabase-migrations.yml` to:
1. install Supabase CLI,
2. link to the project using repository secrets,
3. run `supabase db push`.

### Migration review safety checklist

Before merge:

- [ ] Migration is additive by default (no destructive operations unless explicitly approved).
- [ ] RLS is enabled for every new table with policies for teacher/student boundaries.
- [ ] Sensitive keys are not in source code.
- [ ] Migration was validated locally with `supabase db push`.
- [ ] Rollback/mitigation notes are included for risky changes.
