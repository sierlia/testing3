-- Records, generated newsletters, and lobbying/money support.

create table if not exists public.custom_records (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  type text not null default 'record',
  title text not null,
  body text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  generated boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_records_class_created_idx on public.custom_records(class_id, created_at desc);

create table if not exists public.lobbyist_groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  description text not null default '',
  join_mode text not null default 'free_join' check (join_mode in ('free_join', 'teacher_assigned')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);

create table if not exists public.lobbyist_group_members (
  group_id uuid not null references public.lobbyist_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by_teacher boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.lobbyist_contributions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  group_id uuid references public.lobbyist_groups(id) on delete set null,
  from_user_id uuid references auth.users(id) on delete set null,
  recipient_type text not null check (recipient_type in ('member', 'party', 'committee', 'caucus')),
  recipient_id text not null,
  amount integer not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.committee_paid_access (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_type text not null check (access_type in ('dashboard', 'review')),
  group_id uuid references public.lobbyist_groups(id) on delete set null,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (committee_id, user_id, access_type)
);

alter table public.custom_records enable row level security;
alter table public.lobbyist_groups enable row level security;
alter table public.lobbyist_group_members enable row level security;
alter table public.lobbyist_contributions enable row level security;
alter table public.committee_paid_access enable row level security;

drop policy if exists "class members read custom records" on public.custom_records;
create policy "class members read custom records" on public.custom_records
for select using (class_id = public.my_class_id());

drop policy if exists "teachers manage custom records" on public.custom_records;
create policy "teachers manage custom records" on public.custom_records
for all using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()))
with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));

drop policy if exists "class members read lobbyist groups" on public.lobbyist_groups;
create policy "class members read lobbyist groups" on public.lobbyist_groups
for select using (class_id = public.my_class_id());

drop policy if exists "teachers manage lobbyist groups" on public.lobbyist_groups;
create policy "teachers manage lobbyist groups" on public.lobbyist_groups
for all using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()))
with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));

drop policy if exists "class members read lobbyist memberships" on public.lobbyist_group_members;
create policy "class members read lobbyist memberships" on public.lobbyist_group_members
for select using (exists (
  select 1 from public.lobbyist_groups g
  where g.id = lobbyist_group_members.group_id and g.class_id = public.my_class_id()
));

drop policy if exists "students join free lobbyist groups" on public.lobbyist_group_members;
create policy "students join free lobbyist groups" on public.lobbyist_group_members
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.lobbyist_groups g
    where g.id = group_id and g.class_id = public.my_class_id() and g.join_mode = 'free_join'
  )
);

drop policy if exists "members leave free lobbyist groups" on public.lobbyist_group_members;
create policy "members leave free lobbyist groups" on public.lobbyist_group_members
for delete using (
  user_id = auth.uid()
  and exists (
    select 1 from public.lobbyist_groups g
    where g.id = group_id and g.class_id = public.my_class_id() and g.join_mode = 'free_join'
  )
);

drop policy if exists "teachers manage lobbyist memberships" on public.lobbyist_group_members;
create policy "teachers manage lobbyist memberships" on public.lobbyist_group_members
for all using (exists (
  select 1 from public.lobbyist_groups g
  join public.classes c on c.id = g.class_id
  where g.id = group_id and c.teacher_id = auth.uid()
))
with check (exists (
  select 1 from public.lobbyist_groups g
  join public.classes c on c.id = g.class_id
  where g.id = group_id and c.teacher_id = auth.uid()
));

drop policy if exists "class members read contributions" on public.lobbyist_contributions;
create policy "class members read contributions" on public.lobbyist_contributions
for select using (class_id = public.my_class_id());

drop policy if exists "lobbyists create contributions" on public.lobbyist_contributions;
create policy "lobbyists create contributions" on public.lobbyist_contributions
for insert with check (
  class_id = public.my_class_id()
  and from_user_id = auth.uid()
  and exists (
    select 1 from public.lobbyist_group_members m
    join public.lobbyist_groups g on g.id = m.group_id
    where m.group_id = lobbyist_contributions.group_id
      and m.user_id = auth.uid()
      and g.class_id = lobbyist_contributions.class_id
  )
);

drop policy if exists "teachers read paid access" on public.committee_paid_access;
create policy "teachers read paid access" on public.committee_paid_access
for select using (exists (
  select 1 from public.committees c
  join public.classes cls on cls.id = c.class_id
  where c.id = committee_paid_access.committee_id and cls.teacher_id = auth.uid()
));

drop policy if exists "users read own paid access" on public.committee_paid_access;
create policy "users read own paid access" on public.committee_paid_access
for select using (user_id = auth.uid());

drop policy if exists "lobbyists buy committee access" on public.committee_paid_access;
create policy "lobbyists buy committee access" on public.committee_paid_access
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.committees c where c.id = committee_id and c.class_id = public.my_class_id()
  )
  and exists (
    select 1 from public.lobbyist_group_members m where m.group_id = group_id and m.user_id = auth.uid()
  )
);
