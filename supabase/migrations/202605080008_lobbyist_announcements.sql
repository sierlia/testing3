-- Lobbyist group dashboard announcement boards.

create table if not exists public.lobbyist_group_announcements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.lobbyist_groups(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists lobbyist_group_announcements_group_created_idx
  on public.lobbyist_group_announcements(group_id, created_at desc);

create index if not exists lobbyist_group_announcements_class_created_idx
  on public.lobbyist_group_announcements(class_id, created_at desc);

alter table public.lobbyist_group_announcements enable row level security;

drop policy if exists "class members read lobbyist group announcements" on public.lobbyist_group_announcements;
create policy "class members read lobbyist group announcements"
on public.lobbyist_group_announcements
for select
to authenticated
using (
  class_id = public.my_class_id()
  or exists (
    select 1 from public.classes c
    where c.id = class_id and c.teacher_id = auth.uid()
  )
);

drop policy if exists "lobbyist members post announcements" on public.lobbyist_group_announcements;
create policy "lobbyist members post announcements"
on public.lobbyist_group_announcements
for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.lobbyist_groups g
    where g.id = group_id
      and g.class_id = class_id
      and (
        g.class_id = public.my_class_id()
        or exists (
          select 1 from public.classes c
          where c.id = g.class_id and c.teacher_id = auth.uid()
        )
      )
  )
  and (
    exists (
      select 1
      from public.lobbyist_group_members m
      where m.group_id = group_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.classes c
      where c.id = class_id and c.teacher_id = auth.uid()
    )
  )
);

drop policy if exists "teachers delete lobbyist group announcements" on public.lobbyist_group_announcements;
create policy "teachers delete lobbyist group announcements"
on public.lobbyist_group_announcements
for delete
to authenticated
using (
  exists (
    select 1 from public.classes c
    where c.id = class_id and c.teacher_id = auth.uid()
  )
);
