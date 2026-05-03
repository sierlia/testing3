-- Let class teachers participate in and moderate organization announcement boards.

drop policy if exists "teachers post committee announcements" on public.committee_announcements;
create policy "teachers post committee announcements" on public.committee_announcements
for insert with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.committees co
    join public.classes c on c.id = co.class_id
    where co.id = committee_announcements.committee_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers delete committee announcements" on public.committee_announcements;
create policy "teachers delete committee announcements" on public.committee_announcements
for delete using (
  exists (
    select 1
    from public.committees co
    join public.classes c on c.id = co.class_id
    where co.id = committee_announcements.committee_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers comment on committee announcements" on public.committee_comments;
create policy "teachers comment on committee announcements" on public.committee_comments
for insert with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.committee_announcements a
    join public.committees co on co.id = a.committee_id
    join public.classes c on c.id = co.class_id
    where a.id = announcement_id
      and c.teacher_id = auth.uid()
  )
  and (
    parent_comment_id is null
    or public.committee_parent_comment_valid(parent_comment_id, announcement_id)
  )
);

drop policy if exists "teachers delete committee comments" on public.committee_comments;
create policy "teachers delete committee comments" on public.committee_comments
for delete using (
  exists (
    select 1
    from public.committee_announcements a
    join public.committees co on co.id = a.committee_id
    join public.classes c on c.id = co.class_id
    where a.id = announcement_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers post caucus announcements" on public.caucus_announcements;
create policy "teachers post caucus announcements" on public.caucus_announcements
for insert with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.caucuses ca
    join public.classes c on c.id = ca.class_id
    where ca.id = caucus_announcements.caucus_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers delete caucus announcements" on public.caucus_announcements;
create policy "teachers delete caucus announcements" on public.caucus_announcements
for delete using (
  exists (
    select 1
    from public.caucuses ca
    join public.classes c on c.id = ca.class_id
    where ca.id = caucus_announcements.caucus_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers comment on caucus announcements" on public.caucus_comments;
create policy "teachers comment on caucus announcements" on public.caucus_comments
for insert with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.caucus_announcements a
    join public.caucuses ca on ca.id = a.caucus_id
    join public.classes c on c.id = ca.class_id
    where a.id = announcement_id
      and c.teacher_id = auth.uid()
  )
  and (
    parent_comment_id is null
    or public.caucus_parent_comment_valid(parent_comment_id, announcement_id)
  )
);

drop policy if exists "teachers delete caucus comments" on public.caucus_comments;
create policy "teachers delete caucus comments" on public.caucus_comments
for delete using (
  exists (
    select 1
    from public.caucus_announcements a
    join public.caucuses ca on ca.id = a.caucus_id
    join public.classes c on c.id = ca.class_id
    where a.id = announcement_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers post party announcements" on public.party_announcements;
create policy "teachers post party announcements" on public.party_announcements
for insert with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.classes c
    where c.id = party_announcements.class_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers delete party announcements" on public.party_announcements;
create policy "teachers delete party announcements" on public.party_announcements
for delete using (
  exists (
    select 1
    from public.classes c
    where c.id = party_announcements.class_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers comment on party announcements" on public.party_comments;
create policy "teachers comment on party announcements" on public.party_comments
for insert with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.party_announcements a
    join public.classes c on c.id = a.class_id
    where a.id = announcement_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers delete party comments" on public.party_comments;
create policy "teachers delete party comments" on public.party_comments
for delete using (
  exists (
    select 1
    from public.party_announcements a
    join public.classes c on c.id = a.class_id
    where a.id = announcement_id
      and c.teacher_id = auth.uid()
  )
);
