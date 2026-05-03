drop policy if exists "users can update own memberships" on public.class_memberships;
create policy "users can update own memberships" on public.class_memberships
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.invite_teacher_to_class(target_class uuid, teacher_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invited_user uuid;
  normalized_email text;
  class_name text;
begin
  normalized_email := lower(trim(teacher_email));
  if normalized_email = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  select c.name into class_name
  from public.classes c
  where c.id = target_class
    and (
      c.teacher_id = auth.uid()
      or exists (
        select 1 from public.class_memberships m
        where m.class_id = c.id
          and m.user_id = auth.uid()
          and m.role = 'teacher'
          and coalesce(m.status, 'approved') = 'approved'
      )
    );
  if class_name is null then
    raise exception 'NOT_ALLOWED';
  end if;

  select u.id into invited_user
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;
  if invited_user is null then
    raise exception 'TEACHER_NOT_FOUND';
  end if;

  insert into public.class_memberships (class_id, user_id, role, status, email)
  values (target_class, invited_user, 'teacher', 'invited', normalized_email)
  on conflict (class_id, user_id)
  do update set role = 'teacher', status = 'invited', email = excluded.email;

  insert into public.profiles (user_id, role, display_name)
  values (invited_user, 'teacher', null)
  on conflict (user_id)
  do update set role = 'teacher', updated_at = now();

  perform public.create_notification(
    target_class,
    invited_user,
    auth.uid(),
    'system',
    target_class,
    'class.teacher_invite',
    'Class teacher invitation',
    'You were invited to teach ' || class_name || '.',
    '/teacher/dashboard'
  );

  return invited_user;
end;
$$;

revoke all on function public.invite_teacher_to_class(uuid, text) from public;
grant execute on function public.invite_teacher_to_class(uuid, text) to authenticated;
