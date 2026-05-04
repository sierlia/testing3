update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    recovery_token = coalesce(recovery_token, ''),
    updated_at = now()
where email in (
  'student1@gavel.demo',
  'student2@gavel.demo',
  'teacher1@gavel.demo',
  'teacher2@gavel.demo'
);

create or replace function public.invite_student_to_class(target_class uuid, student_email text)
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
  normalized_email := lower(trim(student_email));
  if normalized_email = '' or normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  select c.name into class_name
  from public.classes c
  where c.id = target_class
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
    );
  if class_name is null then
    raise exception 'NOT_ALLOWED';
  end if;

  select u.id into invited_user
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;
  if invited_user is null then
    return null;
  end if;

  insert into public.class_memberships (class_id, user_id, role, status, email)
  values (target_class, invited_user, 'student', 'invited', normalized_email)
  on conflict (class_id, user_id)
  do update set role = 'student', status = 'invited', email = excluded.email;

  insert into public.profiles (user_id, role, display_name)
  values (invited_user, 'student', null)
  on conflict (user_id)
  do update set role = 'student', updated_at = now();

  perform public.create_notification(
    target_class,
    invited_user,
    auth.uid(),
    'system',
    target_class,
    'class.student_invite',
    'Class invitation',
    'You were invited to join ' || class_name || '.',
    '/settings/classes'
  );

  return invited_user;
end;
$$;

revoke all on function public.invite_student_to_class(uuid, text) from public;
grant execute on function public.invite_student_to_class(uuid, text) to authenticated;
