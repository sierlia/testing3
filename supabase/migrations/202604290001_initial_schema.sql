create extension if not exists pgcrypto;

create type public.app_role as enum ('teacher', 'student');
create type public.membership_role as enum ('member', 'co_chair', 'chair');

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  class_code text not null unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  role public.app_role not null,
  display_name text,
  party text,
  district_slug text,
  onboarding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.committees (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.caucuses (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  description text,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.caucus_members (
  caucus_id uuid not null references public.caucuses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (caucus_id, user_id)
);

create table public.caucus_announcements (
  id uuid primary key default gen_random_uuid(),
  caucus_id uuid not null references public.caucuses(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.caucus_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.caucus_announcements(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create sequence if not exists public.bill_number_seq start 1;

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  bill_number integer not null unique default nextval('public.bill_number_seq'),
  title text not null,
  legislative_text text not null,
  supporting_text text,
  status text not null default 'submitted',
  created_at timestamptz not null default now()
);

create table public.bill_cosponsors (
  bill_id uuid not null references public.bills(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bill_id, user_id)
);

create or replace view public.bill_display as
select b.*, ('H.R. ' || b.bill_number::text) as hr_label
from public.bills b;

alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.committees enable row level security;
alter table public.caucuses enable row level security;
alter table public.caucus_members enable row level security;
alter table public.caucus_announcements enable row level security;
alter table public.caucus_comments enable row level security;
alter table public.bills enable row level security;
alter table public.bill_cosponsors enable row level security;

create or replace function public.my_class_id() returns uuid language sql stable as $$
  select class_id from public.profiles where user_id = auth.uid()
$$;

create policy "class members can read classes" on public.classes
for select using (id = public.my_class_id());

create policy "teachers can create classes" on public.classes
for insert with check (teacher_id = auth.uid());

create policy "teacher can update own classes" on public.classes
for update using (teacher_id = auth.uid());

create policy "class members can read profiles" on public.profiles
for select using (class_id = public.my_class_id());

create policy "users manage own profile" on public.profiles
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "class members read committees" on public.committees
for select using (class_id = public.my_class_id());
create policy "teachers manage committees" on public.committees
for all using (exists (select 1 from public.classes c where c.id = committees.class_id and c.teacher_id = auth.uid()))
with check (exists (select 1 from public.classes c where c.id = committees.class_id and c.teacher_id = auth.uid()));

create policy "class members read caucuses" on public.caucuses
for select using (class_id = public.my_class_id());
create policy "students create caucuses" on public.caucuses
for insert with check (creator_user_id = auth.uid() and class_id = public.my_class_id());

create policy "members read memberships" on public.caucus_members
for select using (exists (select 1 from public.caucuses c where c.id = caucus_id and c.class_id = public.my_class_id()));
create policy "users join caucus" on public.caucus_members
for insert with check (user_id = auth.uid());

create policy "class members read announcements" on public.caucus_announcements
for select using (exists (select 1 from public.caucuses c where c.id = caucus_id and c.class_id = public.my_class_id()));
create policy "chairs post announcements" on public.caucus_announcements
for insert with check (
  exists (select 1 from public.caucus_members m where m.caucus_id = caucus_id and m.user_id = auth.uid() and m.role in ('chair', 'co_chair'))
);

create policy "class members read comments" on public.caucus_comments
for select using (
  exists (
    select 1 from public.caucus_announcements a
    join public.caucuses c on c.id = a.caucus_id
    where a.id = announcement_id and c.class_id = public.my_class_id()
  )
);
create policy "class members comment" on public.caucus_comments
for insert with check (author_user_id = auth.uid());

create policy "class members read bills" on public.bills
for select using (class_id = public.my_class_id());
create policy "students submit bills" on public.bills
for insert with check (author_user_id = auth.uid() and class_id = public.my_class_id());

create policy "class members read cosponsors" on public.bill_cosponsors
for select using (exists (select 1 from public.bills b where b.id = bill_id and b.class_id = public.my_class_id()));
create policy "students cosponsor" on public.bill_cosponsors
for insert with check (user_id = auth.uid());
