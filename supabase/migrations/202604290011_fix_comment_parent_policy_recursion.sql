-- Fix RLS recursion for threaded comment inserts by moving parent validation into SECURITY DEFINER helpers

create or replace function public.caucus_parent_comment_valid(parent_id uuid, announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.caucus_comments pc
    where pc.id = parent_id
      and pc.announcement_id = caucus_parent_comment_valid.announcement_id
  )
$$;

create or replace function public.committee_parent_comment_valid(parent_id uuid, announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.committee_comments pc
    where pc.id = parent_id
      and pc.announcement_id = committee_parent_comment_valid.announcement_id
  )
$$;

do $$
begin
  drop policy if exists "caucus members comment (threaded)" on public.caucus_comments;
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
    or public.caucus_parent_comment_valid(parent_comment_id, announcement_id)
  )
);

do $$
begin
  drop policy if exists "committee members comment (threaded)" on public.committee_comments;
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
    or public.committee_parent_comment_valid(parent_comment_id, announcement_id)
  )
);

