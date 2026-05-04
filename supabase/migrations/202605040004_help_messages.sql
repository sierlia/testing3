create table if not exists public.help_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.help_messages enable row level security;

drop policy if exists "anyone can submit help messages" on public.help_messages;
create policy "anyone can submit help messages"
on public.help_messages
for insert
with check (true);

drop policy if exists "teachers can read help messages" on public.help_messages;
create policy "teachers can read help messages"
on public.help_messages
for select
using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'teacher'));
