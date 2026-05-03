alter table public.bill_floor_sessions
  add column if not exists manual_counts jsonb,
  add column if not exists posted_result text,
  add column if not exists results_posted_at timestamptz;

do $$
begin
  alter table public.bill_floor_sessions
    add constraint bill_floor_sessions_posted_result_check
    check (posted_result is null or posted_result in ('passed', 'failed'));
exception
  when duplicate_object then null;
end $$;

drop policy if exists "class members or teacher can read classes" on public.classes;
create policy "class members or teacher can read classes"
on public.classes
for select
using (
  id = public.my_class_id()
  or teacher_id = auth.uid()
  or exists (
    select 1
    from public.class_memberships m
    where m.class_id = classes.id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "co-teachers can update classes" on public.classes;
create policy "co-teachers can update classes"
on public.classes
for update
using (
  teacher_id = auth.uid()
  or exists (
    select 1
    from public.class_memberships m
    where m.class_id = classes.id
      and m.user_id = auth.uid()
      and m.role = 'teacher'
      and coalesce(m.status, 'approved') = 'approved'
  )
)
with check (
  teacher_id = auth.uid()
  or exists (
    select 1
    from public.class_memberships m
    where m.class_id = classes.id
      and m.user_id = auth.uid()
      and m.role = 'teacher'
      and coalesce(m.status, 'approved') = 'approved'
  )
);

drop policy if exists "users can delete own invited memberships" on public.class_memberships;
create policy "users can delete own invited memberships"
on public.class_memberships
for delete
using (user_id = auth.uid() and coalesce(status, 'approved') = 'invited');

drop policy if exists "teachers manage floor sessions" on public.bill_floor_sessions;
create policy "teachers manage floor sessions"
on public.bill_floor_sessions
for all
using (
  exists (
    select 1
    from public.classes c
    where c.id = bill_floor_sessions.class_id
      and (
        c.teacher_id = auth.uid()
        or exists (
          select 1
          from public.class_memberships m
          where m.class_id = c.id
            and m.user_id = auth.uid()
            and m.role = 'teacher'
            and coalesce(m.status, 'approved') = 'approved'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.classes c
    where c.id = bill_floor_sessions.class_id
      and (
        c.teacher_id = auth.uid()
        or exists (
          select 1
          from public.class_memberships m
          where m.class_id = c.id
            and m.user_id = auth.uid()
            and m.role = 'teacher'
            and coalesce(m.status, 'approved') = 'approved'
        )
      )
  )
);

drop policy if exists "teachers update class bills" on public.bills;
create policy "teachers update class bills"
on public.bills
for update
using (
  exists (
    select 1
    from public.classes c
    where c.id = bills.class_id
      and (
        c.teacher_id = auth.uid()
        or exists (
          select 1
          from public.class_memberships m
          where m.class_id = c.id
            and m.user_id = auth.uid()
            and m.role = 'teacher'
            and coalesce(m.status, 'approved') = 'approved'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.classes c
    where c.id = bills.class_id
      and (
        c.teacher_id = auth.uid()
        or exists (
          select 1
          from public.class_memberships m
          where m.class_id = c.id
            and m.user_id = auth.uid()
            and m.role = 'teacher'
            and coalesce(m.status, 'approved') = 'approved'
        )
      )
  )
);
