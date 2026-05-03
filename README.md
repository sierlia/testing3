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
- `SUPABASE_DB_PASSWORD` (database password from Supabase project settings)
- `VITE_SUPABASE_URL` (frontend runtime URL)
- `VITE_SUPABASE_ANON_KEY` (publishable key; current value provided by owner: `sb_publishable_6hAYQ0LqZrMutVFoAb8hzQ_8kbPpnQY`)

### Local migration workflow

```bash
supabase login
supabase link --project-ref qrtccdwxolfuuucadosa
supabase db push
```

- All schema changes must be committed as SQL files in `supabase/migrations/`.

### Deployment workflows

- `supabase-migrations.yml` (on `main` migration changes): links project and runs `supabase db push` with GitHub Secrets.
- `deploy-pages.yml` (on every `main` push): builds and deploys `dist/` to GitHub Pages and sets `VITE_BASE_PATH=/<repo-name>/` so routing works on Pages.
