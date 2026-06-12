# Gavel

## Local development

1. Install dependencies: `npm i`
2. Configure frontend env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. (Optional) Set `VITE_BASE_PATH` only when a host requires absolute asset URLs. By default, builds use relative asset URLs so the same `dist/` works at a domain root, under a subpath, or on GitHub Pages.
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

### Google OAuth redirects

The app uses Supabase OAuth PKCE and sends Google OAuth back to `/auth/callback`, where the app exchanges the code and removes OAuth data from the URL before returning to the hash-routed app. In Supabase Auth settings, keep the Site URL pointed at the deployed app and add the callback URLs to the redirect allow-list.

- Production Site URL: `https://sierlia.github.io/testing3/`
- Production redirect URL: `https://sierlia.github.io/testing3/auth/callback`
- Local dev redirect URL, when testing locally: `http://localhost:5173/auth/callback` or `http://localhost:3000/auth/callback`
- Google Cloud OAuth authorized redirect URI: `https://qrtccdwxolfuuucadosa.supabase.co/auth/v1/callback`

### Deployment workflows

- `supabase-migrations.yml` (on `main` migration changes): links project and runs `supabase db push` with GitHub Secrets.
- `deploy-pages.yml` (on every `main` push): builds and deploys `dist/` to GitHub Pages with `VITE_BASE_PATH=/<repo-name>/`. The build also emits `404.html` so static hosts can fall back to the app shell.
- The repository root also contains committed `/testing3/assets/app.*` fallback files because this Pages site is currently serving from branch root. If Pages is switched to GitHub Actions as the source, those fallback files can be removed.
