-- Core expansions to support organizations, profile layout, committees, and per-class bill numbering

-- 1) Extend membership_role to support committee ranking member
do $$
begin
  alter type public.membership_role add value 'ranking_member';
exception
  when duplicate_object then null;
end $$;

-- 2) District metadata (scraped one-time from Wikipedia)
create table if not exists public.districts (
  slug text primary key,
  name text not null,
  wikipedia_url text,
  cook_pvi text,
  population integer,
  updated_at timestamptz not null default now()
);

alter table public.districts enable row level security;
create policy "class members read districts" on public.districts
for select using (true);

-- 3) Parties (teacher curated + student-created optional)
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  platform text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);

alter table public.parties enable row level security;

create policy "class members read approved parties" on public.parties
for select using (
  class_id = public.my_class_id()
  and (approved = true or exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()))
);

create policy "class members can propose parties" on public.parties
for insert with check (
  class_id = public.my_class_id()
  and created_by = auth.uid()
);

create policy "teachers manage parties" on public.parties
for update using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()))
with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));

-- 4) Committees: membership + announcement board (like caucuses)
create table if not exists public.committee_members (
  committee_id uuid not null references public.committees(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (committee_id, user_id)
);

create table if not exists public.committee_announcements (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.committee_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.committee_announcements(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.committee_members enable row level security;
alter table public.committee_announcements enable row level security;
alter table public.committee_comments enable row level security;

create policy "class members read committee memberships" on public.committee_members
for select using (exists (select 1 from public.committees c where c.id = committee_id and c.class_id = public.my_class_id()));

create policy "users join committee" on public.committee_members
for insert with check (user_id = auth.uid());

create policy "class members read committee announcements" on public.committee_announcements
for select using (exists (select 1 from public.committees c where c.id = committee_id and c.class_id = public.my_class_id()));

create policy "committee leaders post announcements" on public.committee_announcements
for insert with check (
  exists (select 1 from public.committee_members m where m.committee_id = committee_id and m.user_id = auth.uid() and m.role in ('chair', 'co_chair'))
);

create policy "class members read committee comments" on public.committee_comments
for select using (
  exists (
    select 1 from public.committee_announcements a
    join public.committees c on c.id = a.committee_id
    where a.id = announcement_id and c.class_id = public.my_class_id()
  )
);

create policy "class members comment on committee announcements" on public.committee_comments
for insert with check (author_user_id = auth.uid());

-- 5) Teacher-configurable profile layout (sections/boxes)
create table if not exists public.class_profile_sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  section_key text not null,
  title text not null,
  section_type text not null,
  width text not null default 'full' check (width in ('full', 'half')),
  is_editable boolean not null default true,
  is_required boolean not null default false,
  default_value jsonb not null default 'null'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, section_key)
);

create index if not exists class_profile_sections_class_id_pos_idx on public.class_profile_sections(class_id, position);

alter table public.class_profile_sections enable row level security;

create policy "class members read profile sections" on public.class_profile_sections
for select using (class_id = public.my_class_id());

create policy "teachers manage profile sections" on public.class_profile_sections
for all using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()))
with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));

-- 6) Bills: make numbering per-class, not global
do $$
begin
  -- drop global uniqueness if it exists
  if exists (
    select 1 from pg_constraint
    where conname = 'bills_bill_number_key'
  ) then
    alter table public.bills drop constraint bills_bill_number_key;
  end if;
exception when undefined_object then null;
end $$;

create unique index if not exists bills_class_bill_number_uidx on public.bills(class_id, bill_number);

alter table public.bills alter column bill_number drop default;

create or replace function public.next_bill_number_for_class(target_class uuid)
returns integer
language sql
stable
as $$
  select coalesce(max(bill_number), 0) + 1
  from public.bills
  where class_id = target_class
$$;

create or replace function public.set_bill_number_if_missing()
returns trigger
language plpgsql
as $$
begin
  if new.bill_number is null then
    new.bill_number := public.next_bill_number_for_class(new.class_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_bill_number on public.bills;
create trigger trg_set_bill_number
before insert on public.bills
for each row execute function public.set_bill_number_if_missing();
