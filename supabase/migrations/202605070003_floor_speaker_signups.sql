create table if not exists public.bill_floor_speakers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  side text not null check (side in ('for', 'against')),
  created_at timestamptz not null default now(),
  unique (bill_id, user_id)
);

alter table public.bill_floor_speakers enable row level security;

drop policy if exists "class members can read floor speaker signups" on public.bill_floor_speakers;
create policy "class members can read floor speaker signups"
on public.bill_floor_speakers for select
using (
  exists (
    select 1 from public.class_memberships cm
    where cm.class_id = bill_floor_speakers.class_id
      and cm.user_id = auth.uid()
      and cm.status = 'approved'
  )
);

drop policy if exists "class members can manage own floor speaker signup" on public.bill_floor_speakers;
create policy "class members can manage own floor speaker signup"
on public.bill_floor_speakers for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.class_memberships cm
    where cm.class_id = bill_floor_speakers.class_id
      and cm.user_id = auth.uid()
      and cm.status = 'approved'
  )
);

drop policy if exists "teachers can manage floor speaker signups" on public.bill_floor_speakers;
create policy "teachers can manage floor speaker signups"
on public.bill_floor_speakers for all
using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));
