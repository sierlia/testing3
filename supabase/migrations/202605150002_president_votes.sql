create table if not exists public.class_president_votes (
  class_id uuid not null references public.classes(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  candidate_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (class_id, voter_user_id)
);

alter table public.class_president_votes enable row level security;

drop policy if exists "class members read president votes" on public.class_president_votes;
create policy "class members read president votes" on public.class_president_votes
for select using (
  exists (
    select 1 from public.classes c
    where c.id = class_president_votes.class_id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1 from public.class_memberships m
    where m.class_id = class_president_votes.class_id
      and m.user_id = auth.uid()
      and coalesce(m.status, 'approved') = 'approved'
  )
);

drop policy if exists "students write own president votes" on public.class_president_votes;
create policy "students write own president votes" on public.class_president_votes
for insert with check (
  voter_user_id = auth.uid()
  and exists (
    select 1 from public.class_memberships m
    where m.class_id = class_president_votes.class_id
      and m.user_id = auth.uid()
      and m.role = 'student'
      and coalesce(m.status, 'approved') = 'approved'
  )
);

drop policy if exists "students update own president votes" on public.class_president_votes;
create policy "students update own president votes" on public.class_president_votes
for update using (voter_user_id = auth.uid())
with check (voter_user_id = auth.uid());

drop policy if exists "students delete own president votes" on public.class_president_votes;
create policy "students delete own president votes" on public.class_president_votes
for delete using (voter_user_id = auth.uid());

drop policy if exists "presidents sign or veto eligible bills" on public.bills;
create policy "presidents sign or veto eligible bills" on public.bills
for update using (
  status in ('passed', 'senate_passed')
  and exists (
    select 1
    from public.classes c
    where c.id = bills.class_id
      and coalesce((c.settings #>> '{executive,enabled}')::boolean, false)
      and c.settings #>> '{executive,presidentUserId}' = auth.uid()::text
  )
)
with check (
  class_id = public.my_class_id()
  and status in ('signed', 'vetoed')
);
