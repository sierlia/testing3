alter table public.profiles
  add column if not exists written_responses jsonb not null default '{}'::jsonb,
  add column if not exists avatar_url text;
