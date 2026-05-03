create table if not exists public.bill_teacher_overrides (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  step text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.bill_teacher_overrides enable row level security;

drop policy if exists "class members read bill teacher overrides" on public.bill_teacher_overrides;
create policy "class members read bill teacher overrides" on public.bill_teacher_overrides
for select using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.class_id = bill_teacher_overrides.class_id
  )
  or exists (
    select 1 from public.classes c
    where c.id = bill_teacher_overrides.class_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "class teachers create bill teacher overrides" on public.bill_teacher_overrides;
create policy "class teachers create bill teacher overrides" on public.bill_teacher_overrides
for insert with check (
  actor_user_id = auth.uid()
  and exists (
    select 1 from public.classes c
    where c.id = bill_teacher_overrides.class_id
      and c.teacher_id = auth.uid()
  )
);
