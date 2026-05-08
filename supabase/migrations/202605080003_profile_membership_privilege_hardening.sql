-- Harden profile and class membership writes so client-side edits cannot grant
-- teacher privileges or move a user into an arbitrary class.

create or replace function public.profile_role_for(target_user uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.user_id = target_user
  limit 1
$$;

create or replace function public.profile_class_for(target_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.class_id
  from public.profiles p
  where p.user_id = target_user
  limit 1
$$;

create or replace function public.can_set_own_profile_context(
  target_user uuid,
  target_class uuid,
  target_role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_user = auth.uid()
    and (
      (target_role = 'student' and target_class is null)
      or (
        target_role = 'teacher'
        and exists (
          select 1
          from public.classes c
          where c.id = target_class
            and c.teacher_id = auth.uid()
        )
      )
      or exists (
        select 1
        from public.class_memberships m
        where m.class_id = target_class
          and m.user_id = auth.uid()
          and m.role = target_role
          and coalesce(m.status, 'approved') = 'approved'
      )
    )
$$;

create or replace function public.profile_context_unchanged(
  target_user uuid,
  target_class uuid,
  target_role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_role = public.profile_role_for(target_user)
    and target_class is not distinct from public.profile_class_for(target_user)
$$;

create or replace function public.has_invited_teacher_membership(
  target_class uuid,
  target_user uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_memberships m
    where m.class_id = target_class
      and m.user_id = target_user
      and m.role = 'teacher'
      and m.status = 'invited'
  )
$$;

revoke all on function public.profile_role_for(uuid) from public;
revoke all on function public.profile_class_for(uuid) from public;
revoke all on function public.can_set_own_profile_context(uuid, uuid, public.app_role) from public;
revoke all on function public.profile_context_unchanged(uuid, uuid, public.app_role) from public;
revoke all on function public.has_invited_teacher_membership(uuid, uuid) from public;
grant execute on function public.profile_role_for(uuid) to authenticated;
grant execute on function public.profile_class_for(uuid) to authenticated;
grant execute on function public.can_set_own_profile_context(uuid, uuid, public.app_role) to authenticated;
grant execute on function public.profile_context_unchanged(uuid, uuid, public.app_role) to authenticated;
grant execute on function public.has_invited_teacher_membership(uuid, uuid) to authenticated;

-- Repair impossible active class/role contexts before the stricter policies are
-- installed. Pending class joins are preserved because they have membership rows.
update public.profiles p
set class_id = null,
    updated_at = now()
where p.class_id is not null
  and not exists (
    select 1
    from public.classes c
    where c.id = p.class_id
      and c.teacher_id = p.user_id
  )
  and not exists (
    select 1
    from public.class_memberships m
    where m.class_id = p.class_id
      and m.user_id = p.user_id
  );

update public.profiles p
set role = 'student',
    updated_at = now()
where p.role = 'teacher'
  and not exists (
    select 1
    from public.classes c
    where c.id = p.class_id
      and c.teacher_id = p.user_id
  )
  and not exists (
    select 1
    from public.class_memberships m
    where m.class_id = p.class_id
      and m.user_id = p.user_id
      and m.role = 'teacher'
      and coalesce(m.status, 'approved') = 'approved'
  );

-- Profile writes: users may edit their own non-privileged profile fields, and
-- may only activate a class/role that is backed by class ownership or an
-- approved membership. Teachers can manage profiles inside their classes.
drop policy if exists "users manage own profile" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users update own profile fields" on public.profiles;
drop policy if exists "teachers insert class profiles" on public.profiles;
drop policy if exists "teachers update class profiles" on public.profiles;

create policy "users insert own profile"
on public.profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_set_own_profile_context(user_id, class_id, role)
);

create policy "users update own profile fields"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    public.profile_context_unchanged(user_id, class_id, role)
    or public.can_set_own_profile_context(user_id, class_id, role)
  )
);

create policy "teachers insert class profiles"
on public.profiles
for insert
to authenticated
with check (
  class_id is not null
  and public.is_class_teacher(class_id)
);

create policy "teachers update class profiles"
on public.profiles
for update
to authenticated
using (
  class_id is not null
  and public.is_class_teacher(class_id)
)
with check (
  class_id is null
  or public.is_class_teacher(class_id)
);

-- Membership writes: joining must go through join_class_by_code, and accepting
-- a teacher invitation may only convert an existing invited teacher row to
-- approved. Users cannot forge teacher memberships directly.
revoke update (class_id, user_id, role) on table public.class_memberships from authenticated;

drop policy if exists "users can insert own memberships" on public.class_memberships;
drop policy if exists "users can update own memberships" on public.class_memberships;
drop policy if exists "users accept invited teacher memberships" on public.class_memberships;

create policy "users accept invited teacher memberships"
on public.class_memberships
for update
to authenticated
using (
  user_id = auth.uid()
  and role = 'teacher'
  and status = 'invited'
)
with check (
  user_id = auth.uid()
  and role = 'teacher'
  and status = 'approved'
  and public.has_invited_teacher_membership(class_id, user_id)
);

-- Class reads should be based on ownership/membership, not a mutable active
-- profile class alone.
create or replace function public.can_read_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_class_teacher(target_class)
    or exists (
      select 1
      from public.class_memberships m
      where m.class_id = target_class
        and m.user_id = auth.uid()
    )
$$;

revoke all on function public.can_read_class(uuid) from public;
grant execute on function public.can_read_class(uuid) to authenticated;

-- Help messages are still teacher-readable, but no longer depend on the mutable
-- profiles.role field.
drop policy if exists "teachers can read help messages" on public.help_messages;
create policy "teachers can read help messages"
on public.help_messages
for select
to authenticated
using (
  exists (select 1 from public.classes c where c.teacher_id = auth.uid())
  or exists (
    select 1
    from public.class_memberships m
    where m.user_id = auth.uid()
      and m.role = 'teacher'
      and coalesce(m.status, 'approved') = 'approved'
  )
);

revoke update (teacher_id) on table public.classes from authenticated;

create or replace function public.prevent_class_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.teacher_id is distinct from old.teacher_id then
    raise exception 'CLASS_OWNER_CHANGE_DENIED';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_class_owner_change on public.classes;
create trigger prevent_class_owner_change
before update on public.classes
for each row
execute function public.prevent_class_owner_change();
