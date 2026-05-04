drop policy if exists "authors and teachers update committee announcements" on public.committee_announcements;
create policy "authors and teachers update committee announcements"
on public.committee_announcements
for update
using (
  author_user_id = auth.uid()
  or exists (select 1 from public.committees c where c.id = committee_id and public.is_class_teacher(c.class_id))
)
with check (
  author_user_id = auth.uid()
  or exists (select 1 from public.committees c where c.id = committee_id and public.is_class_teacher(c.class_id))
);

drop policy if exists "authors and teachers update committee comments" on public.committee_comments;
create policy "authors and teachers update committee comments"
on public.committee_comments
for update
using (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.committee_announcements a
    join public.committees c on c.id = a.committee_id
    where a.id = committee_comments.announcement_id
      and public.is_class_teacher(c.class_id)
  )
)
with check (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.committee_announcements a
    join public.committees c on c.id = a.committee_id
    where a.id = committee_comments.announcement_id
      and public.is_class_teacher(c.class_id)
  )
);

drop policy if exists "authors and teachers update caucus announcements" on public.caucus_announcements;
create policy "authors and teachers update caucus announcements"
on public.caucus_announcements
for update
using (
  author_user_id = auth.uid()
  or exists (select 1 from public.caucuses c where c.id = caucus_id and public.is_class_teacher(c.class_id))
)
with check (
  author_user_id = auth.uid()
  or exists (select 1 from public.caucuses c where c.id = caucus_id and public.is_class_teacher(c.class_id))
);

drop policy if exists "authors and teachers update caucus comments" on public.caucus_comments;
create policy "authors and teachers update caucus comments"
on public.caucus_comments
for update
using (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.caucus_announcements a
    join public.caucuses c on c.id = a.caucus_id
    where a.id = caucus_comments.announcement_id
      and public.is_class_teacher(c.class_id)
  )
)
with check (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.caucus_announcements a
    join public.caucuses c on c.id = a.caucus_id
    where a.id = caucus_comments.announcement_id
      and public.is_class_teacher(c.class_id)
  )
);

drop policy if exists "authors and teachers update party announcements" on public.party_announcements;
create policy "authors and teachers update party announcements"
on public.party_announcements
for update
using (author_user_id = auth.uid() or public.is_class_teacher(class_id))
with check (author_user_id = auth.uid() or public.is_class_teacher(class_id));

drop policy if exists "authors and teachers update party comments" on public.party_comments;
create policy "authors and teachers update party comments"
on public.party_comments
for update
using (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.party_announcements a
    where a.id = party_comments.announcement_id
      and public.is_class_teacher(a.class_id)
  )
)
with check (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.party_announcements a
    where a.id = party_comments.announcement_id
      and public.is_class_teacher(a.class_id)
  )
);
