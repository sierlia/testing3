-- Allow members to leave organizations and allow chairs/co-chairs to manage roles.

-- Caucus: members can leave (delete own row)
do $$
begin
  drop policy if exists "users leave caucus" on public.caucus_members;
exception when undefined_object then null;
end $$;

create policy "users leave caucus" on public.caucus_members
for delete using (user_id = auth.uid());

-- Caucus: chair/co-chair can update member roles within the same caucus
do $$
begin
  drop policy if exists "caucus leaders manage roles" on public.caucus_members;
exception when undefined_object then null;
end $$;

create policy "caucus leaders manage roles" on public.caucus_members
for update using (
  exists (
    select 1 from public.caucus_members me
    where me.caucus_id = caucus_members.caucus_id
      and me.user_id = auth.uid()
      and me.role in ('chair', 'co_chair')
  )
)
with check (
  exists (
    select 1 from public.caucus_members me
    where me.caucus_id = caucus_members.caucus_id
      and me.user_id = auth.uid()
      and me.role in ('chair', 'co_chair')
  )
);

-- Committee: members can leave
do $$
begin
  drop policy if exists "users leave committee" on public.committee_members;
exception when undefined_object then null;
end $$;

create policy "users leave committee" on public.committee_members
for delete using (user_id = auth.uid());

-- Committee: chair/co-chair can update roles (ranking_member included)
do $$
begin
  drop policy if exists "committee leaders manage roles" on public.committee_members;
exception when undefined_object then null;
end $$;

create policy "committee leaders manage roles" on public.committee_members
for update using (
  exists (
    select 1 from public.committee_members me
    where me.committee_id = committee_members.committee_id
      and me.user_id = auth.uid()
      and me.role in ('chair', 'co_chair')
  )
)
with check (
  exists (
    select 1 from public.committee_members me
    where me.committee_id = committee_members.committee_id
      and me.user_id = auth.uid()
      and me.role in ('chair', 'co_chair')
  )
);
