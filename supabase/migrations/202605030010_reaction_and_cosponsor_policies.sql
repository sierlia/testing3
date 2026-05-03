drop policy if exists "students cosponsor" on public.bill_cosponsors;
create policy "students cosponsor" on public.bill_cosponsors
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.bills b
    where b.id = bill_id
      and b.class_id = public.my_class_id()
      and b.author_user_id <> auth.uid()
  )
);

drop policy if exists "users update own cosponsorship" on public.bill_cosponsors;
create policy "users update own cosponsorship" on public.bill_cosponsors
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users withdraw own cosponsorship" on public.bill_cosponsors;
create policy "users withdraw own cosponsorship" on public.bill_cosponsors
for delete using (user_id = auth.uid());

drop policy if exists "committee members react to announcements" on public.committee_announcement_reactions;
create policy "committee members react to announcements" on public.committee_announcement_reactions
for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.committees c where c.id = committee_id and c.class_id = public.my_class_id())
  and (
    exists (select 1 from public.committee_members m where m.committee_id = committee_id and m.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'teacher' and p.class_id = public.my_class_id())
  )
);

drop policy if exists "committee members react to comments" on public.committee_comment_reactions;
create policy "committee members react to comments" on public.committee_comment_reactions
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.committee_comments cc
    join public.committee_announcements a on a.id = cc.announcement_id
    join public.committees c on c.id = a.committee_id
    where cc.id = comment_id
      and c.class_id = public.my_class_id()
      and (
        exists (select 1 from public.committee_members m where m.committee_id = a.committee_id and m.user_id = auth.uid())
        or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'teacher' and p.class_id = public.my_class_id())
      )
  )
);

drop policy if exists "caucus members react to announcements" on public.caucus_announcement_reactions;
create policy "caucus members react to announcements" on public.caucus_announcement_reactions
for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.caucuses c where c.id = caucus_id and c.class_id = public.my_class_id())
  and (
    exists (select 1 from public.caucus_members m where m.caucus_id = caucus_id and m.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'teacher' and p.class_id = public.my_class_id())
  )
);

drop policy if exists "caucus members react to comments" on public.caucus_comment_reactions;
create policy "caucus members react to comments" on public.caucus_comment_reactions
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.caucus_comments cc
    join public.caucus_announcements a on a.id = cc.announcement_id
    join public.caucuses c on c.id = a.caucus_id
    where cc.id = comment_id
      and c.class_id = public.my_class_id()
      and (
        exists (select 1 from public.caucus_members m where m.caucus_id = a.caucus_id and m.user_id = auth.uid())
        or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'teacher' and p.class_id = public.my_class_id())
      )
  )
);
