# Gavel

## Local development

1. Install dependencies: `npm i`
2. Configure frontend env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. (Optional) For GitHub Pages-like local path behavior: set `VITE_BASE_PATH=/REPO_NAME/`
4. Run app: `npm run dev`

- Routing is configured with hash URLs (`/#/route`) for static-host compatibility, including GitHub Pages SPA refresh behavior.

## Supabase setup (CLI-first)

This repository is configured for Supabase project `qrtccdwxolfuuucadosa`.

### Required GitHub secrets

- `SUPABASE_ACCESS_TOKEN` (personal access token for Supabase CLI auth)
- `SUPABASE_PROJECT_ID` (`qrtccdwxolfuuucadosa`)
- `VITE_SUPABASE_URL` (frontend runtime URL)
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

### Deployment workflows

- `supabase-migrations.yml` (on `main` migration changes): links project and runs `supabase db push` with GitHub Secrets.
- `deploy-pages.yml` (on every `main` push): builds and deploys `dist/` to GitHub Pages and sets `VITE_BASE_PATH=/<repo-name>/` so routing works on Pages.

### Manual setup you need to do

1. In GitHub repo settings, enable **Pages** and set source to **GitHub Actions**.
2. Add these repository secrets:
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_PROJECT_ID` = `qrtccdwxolfuuucadosa`
   - `VITE_SUPABASE_URL` = `https://qrtccdwxolfuuucadosa.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your current publishable key
3. In Supabase Auth settings, add your GitHub Pages URL to allowed redirect URLs (and local dev URL).
4. Push to `main` and verify both workflows succeed.

### Migration review safety checklist

Before merge:

- [ ] Migration is additive by default (no destructive operations unless explicitly approved).
- [ ] RLS is enabled for every new table with policies for teacher/student boundaries.
- [ ] Sensitive keys are not in source code.
- [ ] Migration was validated locally with `supabase db push`.
- [ ] Rollback/mitigation notes are included for risky changes.
