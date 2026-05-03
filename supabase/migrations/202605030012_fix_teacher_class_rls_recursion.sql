create or replace function public.is_class_teacher(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.classes c
      where c.id = target_class
        and c.teacher_id = auth.uid()
    )
    or exists (
      select 1
      from public.class_memberships m
      where m.class_id = target_class
        and m.user_id = auth.uid()
        and m.role = 'teacher'
        and coalesce(m.status, 'approved') = 'approved'
    )
$$;

create or replace function public.can_read_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_class = public.my_class_id()
    or public.is_class_teacher(target_class)
    or exists (
      select 1
      from public.class_memberships m
      where m.class_id = target_class
        and m.user_id = auth.uid()
    )
$$;

revoke all on function public.is_class_teacher(uuid) from public;
revoke all on function public.can_read_class(uuid) from public;
grant execute on function public.is_class_teacher(uuid) to authenticated;
grant execute on function public.can_read_class(uuid) to authenticated;

drop policy if exists "class members or teacher can read classes" on public.classes;
create policy "class members or teacher can read classes"
on public.classes
for select
using (public.can_read_class(id));

drop policy if exists "co-teachers can update classes" on public.classes;
create policy "co-teachers can update classes"
on public.classes
for update
using (public.is_class_teacher(id))
with check (public.is_class_teacher(id));

drop policy if exists "teachers can read class memberships" on public.class_memberships;
create policy "teachers can read class memberships"
on public.class_memberships
for select
using (public.is_class_teacher(class_id));

drop policy if exists "teachers can update class memberships" on public.class_memberships;
create policy "teachers can update class memberships"
on public.class_memberships
for update
using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));

drop policy if exists "teachers can delete class memberships" on public.class_memberships;
create policy "teachers can delete class memberships"
on public.class_memberships
for delete
using (public.is_class_teacher(class_id));

drop policy if exists "teachers manage floor sessions" on public.bill_floor_sessions;
create policy "teachers manage floor sessions"
on public.bill_floor_sessions
for all
using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));

drop policy if exists "teachers update class bills" on public.bills;
create policy "teachers update class bills"
on public.bills
for update
using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));
