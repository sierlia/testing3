alter table public.party_announcements add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.party_announcements add column if not exists updated_at timestamptz not null default now();
alter table public.party_comments add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.party_comments add column if not exists updated_at timestamptz not null default now();

alter table public.committee_announcements add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.committee_announcements add column if not exists updated_at timestamptz not null default now();
alter table public.committee_comments add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.committee_comments add column if not exists updated_at timestamptz not null default now();

alter table public.caucus_announcements add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.caucus_announcements add column if not exists updated_at timestamptz not null default now();
alter table public.caucus_comments add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.caucus_comments add column if not exists updated_at timestamptz not null default now();

alter table public.lobbyist_group_announcements add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.lobbyist_group_announcements add column if not exists updated_at timestamptz not null default now();

alter table public.floor_discussion_areas add column if not exists visibility text not null default 'archive' check (visibility in ('live', 'archive', 'invisible'));
alter table public.floor_discussion_posts add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.floor_discussion_comments add column if not exists attachments jsonb not null default '[]'::jsonb;

update public.floor_discussion_areas
set visibility = case when is_active then 'live' else coalesce(nullif(visibility, ''), 'archive') end;

delete from public.floor_discussion_reactions
where emoji <> 'thumbs_up';

alter table public.floor_discussion_reactions
drop constraint if exists floor_discussion_reactions_emoji_check;

alter table public.floor_discussion_reactions
add constraint floor_discussion_reactions_emoji_check check (emoji in ('thumbs_up'));

drop policy if exists "class members read floor discussion areas" on public.floor_discussion_areas;
create policy "class members read floor discussion areas"
on public.floor_discussion_areas for select
using (public.can_read_class(class_id) and (visibility <> 'invisible' or public.is_class_teacher(class_id)));

drop policy if exists "class members read floor discussion posts" on public.floor_discussion_posts;
create policy "class members read floor discussion posts"
on public.floor_discussion_posts for select
using (
  public.can_read_class(class_id)
  and exists (
    select 1 from public.floor_discussion_areas area
    where area.id = floor_discussion_posts.discussion_id
      and (area.visibility <> 'invisible' or public.is_class_teacher(area.class_id))
  )
);

drop policy if exists "class members read floor discussion comments" on public.floor_discussion_comments;
create policy "class members read floor discussion comments"
on public.floor_discussion_comments for select
using (
  public.can_read_class(class_id)
  and exists (
    select 1 from public.floor_discussion_areas area
    where area.id = floor_discussion_comments.discussion_id
      and (area.visibility <> 'invisible' or public.is_class_teacher(area.class_id))
  )
);

drop policy if exists "class members read floor discussion reactions" on public.floor_discussion_reactions;
create policy "class members read floor discussion reactions"
on public.floor_discussion_reactions for select
using (
  public.can_read_class(class_id)
  and exists (
    select 1
    from public.floor_discussion_posts post
    join public.floor_discussion_areas area on area.id = post.discussion_id
    where post.id = floor_discussion_reactions.post_id
      and (area.visibility <> 'invisible' or public.is_class_teacher(area.class_id))
  )
);

drop policy if exists "class members create floor discussion posts" on public.floor_discussion_posts;
create policy "class members create floor discussion posts"
on public.floor_discussion_posts for insert
with check (
  author_user_id = auth.uid()
  and public.can_read_class(class_id)
  and exists (
    select 1 from public.floor_discussion_areas area
    where area.id = floor_discussion_posts.discussion_id
      and area.visibility = 'live'
  )
);

drop policy if exists "class members create floor discussion comments" on public.floor_discussion_comments;
create policy "class members create floor discussion comments"
on public.floor_discussion_comments for insert
with check (
  author_user_id = auth.uid()
  and public.can_read_class(class_id)
  and exists (
    select 1 from public.floor_discussion_areas area
    where area.id = floor_discussion_comments.discussion_id
      and area.visibility = 'live'
  )
);

drop policy if exists "class members create floor discussion reactions" on public.floor_discussion_reactions;
create policy "class members create floor discussion reactions"
on public.floor_discussion_reactions for insert
with check (
  user_id = auth.uid()
  and public.can_read_class(class_id)
  and emoji = 'thumbs_up'
  and exists (
    select 1
    from public.floor_discussion_posts post
    join public.floor_discussion_areas area on area.id = post.discussion_id
    where post.id = floor_discussion_reactions.post_id
      and area.visibility = 'live'
  )
);

drop policy if exists "authors and teachers update floor discussion comments" on public.floor_discussion_comments;
drop policy if exists "authors update own floor discussion comments" on public.floor_discussion_comments;
create policy "authors update own floor discussion comments"
on public.floor_discussion_comments for update
using (author_user_id = auth.uid())
with check (author_user_id = auth.uid());

alter table public.class_tasks
drop constraint if exists class_tasks_audience_type_check;

alter table public.class_tasks
add constraint class_tasks_audience_type_check
check (audience_type in ('all','party','committee','caucus','lobbyist','selected_students'));

drop policy if exists "class members read tasks" on public.class_tasks;
create policy "class members read tasks" on public.class_tasks
for select
to authenticated
using (
  public.is_class_teacher(class_id)
  or (
    class_id = public.my_class_id()
    and (
      audience_type = 'all'
      or (
        audience_type = 'selected_students'
        and audience_user_ids ? auth.uid()::text
      )
      or (
        audience_type = 'party'
        and exists (
          select 1
          from public.parties pa
          join public.profiles p on p.user_id = auth.uid()
          where pa.id = audience_id
            and pa.class_id = public.class_tasks.class_id
            and p.class_id = public.class_tasks.class_id
            and p.party = pa.name
        )
      )
      or (
        audience_type = 'committee'
        and exists (
          select 1
          from public.committee_members m
          where m.user_id = auth.uid()
            and m.committee_id = audience_id
        )
      )
      or (
        audience_type = 'caucus'
        and exists (
          select 1
          from public.caucus_members m
          where m.user_id = auth.uid()
            and m.caucus_id = audience_id
        )
      )
      or (
        audience_type = 'lobbyist'
        and exists (
          select 1
          from public.lobbyist_group_members m
          where m.user_id = auth.uid()
            and m.group_id = audience_id
        )
      )
    )
  )
);

drop policy if exists "students submit own assignments" on public.assignment_submissions;
create policy "students submit own assignments" on public.assignment_submissions
for insert
to authenticated
with check (
  student_user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (
    select 1
    from public.class_tasks t
    where t.id = assignment_id
      and t.class_id = assignment_submissions.class_id
      and t.task_type = 'assignment'
      and (
        t.audience_type = 'all'
        or (
          t.audience_type = 'selected_students'
          and t.audience_user_ids ? auth.uid()::text
        )
        or (
          t.audience_type = 'party'
          and exists (
            select 1
            from public.parties pa
            join public.profiles p on p.user_id = auth.uid()
            where pa.id = t.audience_id
              and pa.class_id = t.class_id
              and p.class_id = t.class_id
              and p.party = pa.name
          )
        )
        or (
          t.audience_type = 'committee'
          and exists (
            select 1
            from public.committee_members m
            where m.user_id = auth.uid()
              and m.committee_id = t.audience_id
          )
        )
        or (
          t.audience_type = 'caucus'
          and exists (
            select 1
            from public.caucus_members m
            where m.user_id = auth.uid()
              and m.caucus_id = t.audience_id
          )
        )
        or (
          t.audience_type = 'lobbyist'
          and exists (
            select 1
            from public.lobbyist_group_members m
            where m.user_id = auth.uid()
              and m.group_id = t.audience_id
          )
        )
      )
  )
);

drop policy if exists "authors and teachers update committee announcements" on public.committee_announcements;
create policy "authors update committee announcements"
on public.committee_announcements for update
using (author_user_id = auth.uid())
with check (author_user_id = auth.uid());

drop policy if exists "authors and teachers update committee comments" on public.committee_comments;
create policy "authors update committee comments"
on public.committee_comments for update
using (author_user_id = auth.uid())
with check (author_user_id = auth.uid());

drop policy if exists "authors and teachers update caucus announcements" on public.caucus_announcements;
create policy "authors update caucus announcements"
on public.caucus_announcements for update
using (author_user_id = auth.uid())
with check (author_user_id = auth.uid());

drop policy if exists "authors and teachers update caucus comments" on public.caucus_comments;
create policy "authors update caucus comments"
on public.caucus_comments for update
using (author_user_id = auth.uid())
with check (author_user_id = auth.uid());

drop policy if exists "authors and teachers update party announcements" on public.party_announcements;
create policy "authors update party announcements"
on public.party_announcements for update
using (author_user_id = auth.uid())
with check (author_user_id = auth.uid());

drop policy if exists "authors and teachers update party comments" on public.party_comments;
create policy "authors update party comments"
on public.party_comments for update
using (author_user_id = auth.uid())
with check (author_user_id = auth.uid());

drop policy if exists "authors and teachers update lobbyist group announcements" on public.lobbyist_group_announcements;
drop policy if exists "authors update lobbyist group announcements" on public.lobbyist_group_announcements;
create policy "authors update lobbyist group announcements"
on public.lobbyist_group_announcements for update
using (author_user_id = auth.uid())
with check (author_user_id = auth.uid());
