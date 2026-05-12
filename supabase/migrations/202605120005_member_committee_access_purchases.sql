drop policy if exists "class members buy committee access" on public.committee_paid_access;
create policy "class members buy committee access"
on public.committee_paid_access for insert
with check (
  user_id = auth.uid()
  and group_id is null
  and exists (
    select 1
    from public.committees c
    where c.id = committee_id
      and c.class_id = public.my_class_id()
  )
);

drop policy if exists "class members create personal spending records" on public.lobbyist_contributions;
create policy "class members create personal spending records"
on public.lobbyist_contributions for insert
with check (
  class_id = public.my_class_id()
  and from_user_id = auth.uid()
  and group_id is null
);
