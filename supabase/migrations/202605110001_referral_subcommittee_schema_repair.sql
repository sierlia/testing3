-- Defensive repair for environments where the multi-referral/subcommittee
-- migration did not fully apply before later UI code was deployed.

create table if not exists public.subcommittees (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists subcommittees_committee_name_idx
  on public.subcommittees(committee_id, name);

create index if not exists subcommittees_committee_id_idx
  on public.subcommittees(committee_id);

create index if not exists subcommittees_class_id_idx
  on public.subcommittees(class_id);

alter table public.bill_referrals
  add column if not exists subcommittee_id uuid references public.subcommittees(id) on delete set null;

create index if not exists bill_referrals_subcommittee_id_idx
  on public.bill_referrals(subcommittee_id);

delete from public.bill_referrals a
using public.bill_referrals b
where a.ctid < b.ctid
  and a.bill_id = b.bill_id
  and a.committee_id = b.committee_id;

alter table public.bill_referrals
  drop constraint if exists bill_referrals_pkey;

alter table public.bill_referrals
  add constraint bill_referrals_pkey primary key (bill_id, committee_id);

create table if not exists public.subcommittee_members (
  subcommittee_id uuid not null references public.subcommittees(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','chair','ranking_member')),
  created_at timestamptz not null default now(),
  primary key (subcommittee_id, user_id)
);

create index if not exists subcommittee_members_user_id_idx
  on public.subcommittee_members(user_id);

alter table public.subcommittees enable row level security;
alter table public.subcommittee_members enable row level security;

drop policy if exists "class members read subcommittees" on public.subcommittees;
create policy "class members read subcommittees" on public.subcommittees
for select using (class_id = public.my_class_id());

drop policy if exists "teachers manage subcommittees" on public.subcommittees;
create policy "teachers manage subcommittees" on public.subcommittees
for all using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));

drop policy if exists "committee leaders manage subcommittees" on public.subcommittees;
create policy "committee leaders manage subcommittees" on public.subcommittees
for all using (public.is_committee_leader(committee_id, auth.uid()))
with check (public.is_committee_leader(committee_id, auth.uid()));

drop policy if exists "class members read subcommittee members" on public.subcommittee_members;
create policy "class members read subcommittee members" on public.subcommittee_members
for select using (
  exists (
    select 1 from public.subcommittees s
    where s.id = subcommittee_members.subcommittee_id
      and s.class_id = public.my_class_id()
  )
);

drop policy if exists "committee members join subcommittees" on public.subcommittee_members;
create policy "committee members join subcommittees" on public.subcommittee_members
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.subcommittees s
    left join public.committee_members m on m.committee_id = s.committee_id and m.user_id = auth.uid()
    where s.id = subcommittee_members.subcommittee_id
      and s.class_id = public.my_class_id()
      and (m.user_id = auth.uid() or public.is_class_teacher(s.class_id))
  )
);

drop policy if exists "users leave subcommittees" on public.subcommittee_members;
create policy "users leave subcommittees" on public.subcommittee_members
for delete using (
  user_id = auth.uid()
  or exists (
    select 1 from public.subcommittees s
    where s.id = subcommittee_members.subcommittee_id
      and (public.is_class_teacher(s.class_id) or public.is_committee_leader(s.committee_id, auth.uid()))
  )
);

drop policy if exists "teachers and leaders update subcommittee roles" on public.subcommittee_members;
create policy "teachers and leaders update subcommittee roles" on public.subcommittee_members
for update using (
  exists (
    select 1 from public.subcommittees s
    where s.id = subcommittee_members.subcommittee_id
      and (public.is_class_teacher(s.class_id) or public.is_committee_leader(s.committee_id, auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.subcommittees s
    where s.id = subcommittee_members.subcommittee_id
      and (public.is_class_teacher(s.class_id) or public.is_committee_leader(s.committee_id, auth.uid()))
  )
);

drop policy if exists "subcommittee members update own role choice" on public.subcommittee_members;
create policy "subcommittee members update own role choice" on public.subcommittee_members
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "committee leaders update referral subcommittees" on public.bill_referrals;
create policy "committee leaders update referral subcommittees" on public.bill_referrals
for update using (
  public.is_committee_leader(committee_id, auth.uid())
  or public.is_class_teacher(class_id)
)
with check (
  public.is_committee_leader(committee_id, auth.uid())
  or public.is_class_teacher(class_id)
);
