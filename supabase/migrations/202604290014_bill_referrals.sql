-- Bills referred to committees (used by teacher bill sorting + committee workspace)

create table if not exists public.bill_referrals (
  bill_id uuid primary key references public.bills(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  referred_by uuid references auth.users(id) on delete set null,
  referred_at timestamptz not null default now()
);

create index if not exists bill_referrals_committee_id_idx on public.bill_referrals(committee_id);
create index if not exists bill_referrals_class_id_idx on public.bill_referrals(class_id);

alter table public.bill_referrals enable row level security;

do $$
begin
  drop policy if exists "class members read bill referrals" on public.bill_referrals;
exception when undefined_object then null;
end $$;
create policy "class members read bill referrals" on public.bill_referrals
for select using (class_id = public.my_class_id());

do $$
begin
  drop policy if exists "teachers manage bill referrals" on public.bill_referrals;
exception when undefined_object then null;
end $$;
create policy "teachers manage bill referrals" on public.bill_referrals
for all using (
  exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
)
with check (
  exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
);

