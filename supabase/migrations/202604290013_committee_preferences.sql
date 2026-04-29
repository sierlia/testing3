-- Committee preference survey + submission tracking

create table if not exists public.committee_preferences (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  rank integer not null check (rank >= 1),
  created_at timestamptz not null default now(),
  primary key (class_id, user_id, committee_id)
);

create index if not exists committee_preferences_class_user_rank_idx on public.committee_preferences(class_id, user_id, rank);

create table if not exists public.committee_preference_submissions (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

alter table public.committee_preferences enable row level security;
alter table public.committee_preference_submissions enable row level security;

-- Students manage their own preferences in active class
do $$
begin
  drop policy if exists "users manage own committee preferences" on public.committee_preferences;
exception when undefined_object then null;
end $$;
create policy "users manage own committee preferences" on public.committee_preferences
for all using (user_id = auth.uid() and class_id = public.my_class_id())
with check (user_id = auth.uid() and class_id = public.my_class_id());

do $$
begin
  drop policy if exists "users manage own committee preference submission" on public.committee_preference_submissions;
exception when undefined_object then null;
end $$;
create policy "users manage own committee preference submission" on public.committee_preference_submissions
for all using (user_id = auth.uid() and class_id = public.my_class_id())
with check (user_id = auth.uid() and class_id = public.my_class_id());

-- Teachers can read everything for their class
do $$
begin
  drop policy if exists "teachers read committee preferences" on public.committee_preferences;
exception when undefined_object then null;
end $$;
create policy "teachers read committee preferences" on public.committee_preferences
for select using (
  exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
);

do $$
begin
  drop policy if exists "teachers read committee preference submissions" on public.committee_preference_submissions;
exception when undefined_object then null;
end $$;
create policy "teachers read committee preference submissions" on public.committee_preference_submissions
for select using (
  exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
);

