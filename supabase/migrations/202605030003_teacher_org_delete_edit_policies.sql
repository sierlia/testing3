drop policy if exists "teachers delete parties" on public.parties;
create policy "teachers delete parties" on public.parties
for delete using (
  exists (
    select 1
    from public.classes c
    where c.id = parties.class_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers manage caucuses" on public.caucuses;
create policy "teachers manage caucuses" on public.caucuses
for all using (
  exists (
    select 1
    from public.classes c
    where c.id = caucuses.class_id
      and c.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.classes c
    where c.id = caucuses.class_id
      and c.teacher_id = auth.uid()
  )
);
