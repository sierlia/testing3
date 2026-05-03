create table if not exists public.party_member_roles (
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('majority_leader', 'majority_whip', 'minority_leader', 'minority_whip', 'leader', 'whip', 'chair', 'vice_chair')),
  created_at timestamptz default now(),
  primary key (party_id, user_id)
);

create unique index if not exists party_member_roles_one_user_per_role
on public.party_member_roles(party_id, role);

alter table public.party_member_roles enable row level security;

drop policy if exists "class members read party roles" on public.party_member_roles;
create policy "class members read party roles"
on public.party_member_roles
for select
using (
  exists (
    select 1
    from public.parties p
    where p.id = party_member_roles.party_id
      and p.class_id = public.my_class_id()
  )
  or exists (
    select 1
    from public.parties p
    where p.id = party_member_roles.party_id
      and public.is_class_teacher(p.class_id)
  )
);

drop policy if exists "teachers manage party roles" on public.party_member_roles;
create policy "teachers manage party roles"
on public.party_member_roles
for all
using (
  exists (
    select 1
    from public.parties p
    where p.id = party_member_roles.party_id
      and public.is_class_teacher(p.class_id)
  )
)
with check (
  exists (
    select 1
    from public.parties p
    where p.id = party_member_roles.party_id
      and public.is_class_teacher(p.class_id)
  )
);
