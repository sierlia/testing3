-- Allow bills to be referred to more than one committee and add committee subcommittees.

alter table public.bill_referrals
  drop constraint if exists bill_referrals_pkey;

alter table public.bill_referrals
  add constraint bill_referrals_pkey primary key (bill_id, committee_id);

create table if not exists public.subcommittees (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists subcommittees_committee_id_idx on public.subcommittees(committee_id);
create index if not exists subcommittees_class_id_idx on public.subcommittees(class_id);

alter table public.subcommittees enable row level security;

drop policy if exists "class members read subcommittees" on public.subcommittees;
create policy "class members read subcommittees" on public.subcommittees
for select using (class_id = public.my_class_id());

drop policy if exists "teachers manage subcommittees" on public.subcommittees;
create policy "teachers manage subcommittees" on public.subcommittees
for all using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));
