-- Collaborative bill documents should be accessible to class members.
-- The workspace can be opened by users whose active class has been set, but
-- committee membership rows are not guaranteed to exist at the moment the
-- editor initializes. Using class membership keeps persistence reliable while
-- the page-level UI still controls who can reach the workspace.

do $$
begin
  drop policy if exists "committee members read bill docs" on public.committee_bill_docs;
exception when undefined_object then null;
end $$;

do $$
begin
  drop policy if exists "committee members write bill docs" on public.committee_bill_docs;
exception when undefined_object then null;
end $$;

create policy "class members read bill docs" on public.committee_bill_docs
for select using (
  exists (
    select 1
    from public.class_memberships m
    where m.class_id = committee_bill_docs.class_id
      and m.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.classes c
    where c.id = committee_bill_docs.class_id
      and c.teacher_id = auth.uid()
  )
);

create policy "class members write bill docs" on public.committee_bill_docs
for all using (
  exists (
    select 1
    from public.class_memberships m
    where m.class_id = committee_bill_docs.class_id
      and m.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.classes c
    where c.id = committee_bill_docs.class_id
      and c.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.class_memberships m
    where m.class_id = committee_bill_docs.class_id
      and m.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.classes c
    where c.id = committee_bill_docs.class_id
      and c.teacher_id = auth.uid()
  )
);
