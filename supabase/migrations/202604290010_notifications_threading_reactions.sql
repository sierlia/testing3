-- Notifications preferences + threaded comments + reactions

-- 1) Persist notification preferences per-user
alter table public.profiles
add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

-- 2) Threaded replies for announcement comments
alter table public.caucus_comments
add column if not exists parent_comment_id uuid references public.caucus_comments(id) on delete cascade;

alter table public.committee_comments
add column if not exists parent_comment_id uuid references public.committee_comments(id) on delete cascade;

-- Tighten comment insert policies to require membership and valid parent linkage
do $$
begin
  drop policy if exists "class members comment" on public.caucus_comments;
exception when undefined_object then null;
end $$;

create policy "caucus members comment (threaded)" on public.caucus_comments
for insert with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.caucus_announcements a
    join public.caucus_members m on m.caucus_id = a.caucus_id
    join public.caucuses c on c.id = a.caucus_id
    where a.id = announcement_id
      and m.user_id = auth.uid()
      and c.class_id = public.my_class_id()
  )
  and (
    parent_comment_id is null
    or exists (
      select 1
      from public.caucus_comments pc
      where pc.id = parent_comment_id
        and pc.announcement_id = announcement_id
    )
  )
);

do $$
begin
  drop policy if exists "class members comment on committee announcements" on public.committee_comments;
exception when undefined_object then null;
end $$;

create policy "committee members comment (threaded)" on public.committee_comments
for insert with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.committee_announcements a
    join public.committee_members m on m.committee_id = a.committee_id
    join public.committees c on c.id = a.committee_id
    where a.id = announcement_id
      and m.user_id = auth.uid()
      and c.class_id = public.my_class_id()
  )
  and (
    parent_comment_id is null
    or exists (
      select 1
      from public.committee_comments pc
      where pc.id = parent_comment_id
        and pc.announcement_id = announcement_id
    )
  )
);

-- 3) Reactions (announcements + comments) with preset emojis
create table if not exists public.caucus_announcement_reactions (
  id uuid primary key default gen_random_uuid(),
  caucus_id uuid not null references public.caucuses(id) on delete cascade,
  announcement_id uuid not null references public.caucus_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','👎','🎉')),
  created_at timestamptz not null default now(),
  unique (announcement_id, user_id, emoji)
);

create table if not exists public.caucus_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.caucus_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','👎','🎉')),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create table if not exists public.committee_announcement_reactions (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  announcement_id uuid not null references public.committee_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','👎','🎉')),
  created_at timestamptz not null default now(),
  unique (announcement_id, user_id, emoji)
);

create table if not exists public.committee_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.committee_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','👎','🎉')),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

alter table public.caucus_announcement_reactions enable row level security;
alter table public.caucus_comment_reactions enable row level security;
alter table public.committee_announcement_reactions enable row level security;
alter table public.committee_comment_reactions enable row level security;

-- Read policies (class-scoped through memberships)
create policy "class members read caucus announcement reactions" on public.caucus_announcement_reactions
for select using (
  exists (select 1 from public.caucuses c where c.id = caucus_id and c.class_id = public.my_class_id())
);

create policy "class members read caucus comment reactions" on public.caucus_comment_reactions
for select using (
  exists (
    select 1
    from public.caucus_comments cc
    join public.caucus_announcements a on a.id = cc.announcement_id
    join public.caucuses c on c.id = a.caucus_id
    where cc.id = comment_id and c.class_id = public.my_class_id()
  )
);

create policy "class members read committee announcement reactions" on public.committee_announcement_reactions
for select using (
  exists (select 1 from public.committees c where c.id = committee_id and c.class_id = public.my_class_id())
);

create policy "class members read committee comment reactions" on public.committee_comment_reactions
for select using (
  exists (
    select 1
    from public.committee_comments cc
    join public.committee_announcements a on a.id = cc.announcement_id
    join public.committees c on c.id = a.committee_id
    where cc.id = comment_id and c.class_id = public.my_class_id()
  )
);

-- Insert/delete policies (must be member of the org + self-owned)
create policy "caucus members react to announcements" on public.caucus_announcement_reactions
for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.caucus_members m where m.caucus_id = caucus_id and m.user_id = auth.uid())
  and exists (select 1 from public.caucuses c where c.id = caucus_id and c.class_id = public.my_class_id())
);

create policy "users remove own caucus announcement reactions" on public.caucus_announcement_reactions
for delete using (user_id = auth.uid());

create policy "caucus members react to comments" on public.caucus_comment_reactions
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.caucus_comments cc
    join public.caucus_announcements a on a.id = cc.announcement_id
    join public.caucus_members m on m.caucus_id = a.caucus_id
    where cc.id = comment_id and m.user_id = auth.uid()
  )
);

create policy "users remove own caucus comment reactions" on public.caucus_comment_reactions
for delete using (user_id = auth.uid());

create policy "committee members react to announcements" on public.committee_announcement_reactions
for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.committee_members m where m.committee_id = committee_id and m.user_id = auth.uid())
  and exists (select 1 from public.committees c where c.id = committee_id and c.class_id = public.my_class_id())
);

create policy "users remove own committee announcement reactions" on public.committee_announcement_reactions
for delete using (user_id = auth.uid());

create policy "committee members react to comments" on public.committee_comment_reactions
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.committee_comments cc
    join public.committee_announcements a on a.id = cc.announcement_id
    join public.committee_members m on m.committee_id = a.committee_id
    where cc.id = comment_id and m.user_id = auth.uid()
  )
);

create policy "users remove own committee comment reactions" on public.committee_comment_reactions
for delete using (user_id = auth.uid());

