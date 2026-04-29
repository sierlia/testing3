-- Fix teacher committee assignment inserts, fix caucus role-update recursion, add teacher tasks & dear colleague letters

-- 1) Committee memberships: allow teacher to manage committee_members for their class
do $$
begin
  drop policy if exists "teachers manage committee memberships" on public.committee_members;
exception when undefined_object then null;
end $$;

create policy "teachers manage committee memberships" on public.committee_members
for all using (
  exists (
    select 1
    from public.committees co
    join public.classes c on c.id = co.class_id
    where co.id = committee_members.committee_id
      and c.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.committees co
    join public.classes c on c.id = co.class_id
    where co.id = committee_members.committee_id
      and c.teacher_id = auth.uid()
  )
);

-- 2) Caucus role update recursion fix: use SECURITY DEFINER helper
create or replace function public.is_caucus_leader(target_caucus uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.caucus_members m
    where m.caucus_id = target_caucus
      and m.user_id = target_user
      and m.role in ('chair','co_chair')
  )
$$;

do $$
begin
  drop policy if exists "caucus leaders manage roles" on public.caucus_members;
exception when undefined_object then null;
end $$;

create policy "caucus leaders manage roles" on public.caucus_members
for update using (public.is_caucus_leader(caucus_members.caucus_id, auth.uid()))
with check (public.is_caucus_leader(caucus_members.caucus_id, auth.uid()));

-- 3) Teacher deadlines & assignments (tasks)
create table if not exists public.class_tasks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  task_type text not null check (task_type in ('deadline','assignment')),
  audience_type text not null default 'all' check (audience_type in ('all','party','committee','caucus')),
  audience_id uuid,
  title text not null,
  description text not null default '',
  due_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.class_tasks enable row level security;

do $$
begin
  drop policy if exists "class members read tasks" on public.class_tasks;
exception when undefined_object then null;
end $$;
create policy "class members read tasks" on public.class_tasks
for select using (
  class_id = public.my_class_id()
  and (
    audience_type = 'all'
    or (
      audience_type = 'party'
      and exists (
        select 1
        from public.parties pa
        join public.profiles p on p.user_id = auth.uid()
        where pa.id = audience_id
          and pa.class_id = class_id
          and p.party = pa.name
      )
    )
    or (
      audience_type = 'committee'
      and exists (select 1 from public.committee_members m where m.user_id = auth.uid() and m.committee_id = audience_id)
    )
    or (
      audience_type = 'caucus'
      and exists (select 1 from public.caucus_members m where m.user_id = auth.uid() and m.caucus_id = audience_id)
    )
  )
);

do $$
begin
  drop policy if exists "teachers manage tasks" on public.class_tasks;
exception when undefined_object then null;
end $$;
create policy "teachers manage tasks" on public.class_tasks
for all using (
  exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
)
with check (
  exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
);

-- 4) Dear colleague letters
create table if not exists public.dear_colleague_letters (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.dear_colleague_recipients (
  letter_id uuid not null references public.dear_colleague_letters(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  primary key (letter_id, recipient_user_id)
);

alter table public.dear_colleague_letters enable row level security;
alter table public.dear_colleague_recipients enable row level security;

do $$
begin
  drop policy if exists "class members read letters" on public.dear_colleague_letters;
exception when undefined_object then null;
end $$;
create policy "class members read letters" on public.dear_colleague_letters
for select using (class_id = public.my_class_id());

do $$
begin
  drop policy if exists "students send letters" on public.dear_colleague_letters;
exception when undefined_object then null;
end $$;
create policy "students send letters" on public.dear_colleague_letters
for insert with check (class_id = public.my_class_id() and sender_user_id = auth.uid());

do $$
begin
  drop policy if exists "recipients read own" on public.dear_colleague_recipients;
exception when undefined_object then null;
end $$;
create policy "recipients read own" on public.dear_colleague_recipients
for select using (
  recipient_user_id = auth.uid()
  and exists (select 1 from public.dear_colleague_letters l where l.id = letter_id and l.class_id = public.my_class_id())
);

do $$
begin
  drop policy if exists "sender inserts recipients" on public.dear_colleague_recipients;
exception when undefined_object then null;
end $$;
create policy "sender inserts recipients" on public.dear_colleague_recipients
for insert with check (
  exists (select 1 from public.dear_colleague_letters l where l.id = letter_id and l.sender_user_id = auth.uid() and l.class_id = public.my_class_id())
);

do $$
begin
  drop policy if exists "recipients mark read" on public.dear_colleague_recipients;
exception when undefined_object then null;
end $$;
create policy "recipients mark read" on public.dear_colleague_recipients
for update using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

-- Letter notifications: create notification when a recipient row is inserted
create or replace function public.notify_on_dear_colleague_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l record;
begin
  select class_id, sender_user_id, subject
    into l
  from public.dear_colleague_letters
  where id = new.letter_id;

  if l.class_id is null then
    return new;
  end if;

  perform public.create_notification(
    l.class_id,
    new.recipient_user_id,
    l.sender_user_id,
    'system',
    null,
    'letters.new',
    'New Dear Colleague Letter',
    left(coalesce(l.subject, ''), 180),
    '/dear-colleague/inbox'
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_dear_colleague_recipient on public.dear_colleague_recipients;
create trigger trg_notify_dear_colleague_recipient
after insert on public.dear_colleague_recipients
for each row execute function public.notify_on_dear_colleague_recipient();
