drop function if exists public.join_class_by_code(text);

create or replace function public.join_class_by_code(join_code_input text)
returns table(joined_class_id uuid, joined_class_name text, joined_class_code text, joined_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class public.classes%rowtype;
  requester_email text;
  next_status text;
begin
  select c.* into target_class from public.classes c where c.class_code = upper(trim(join_code_input)) limit 1;
  if target_class.id is null then raise exception 'INVALID_CLASS_CODE'; end if;

  requester_email := coalesce(auth.jwt() ->> 'email', '');
  next_status := case
    when coalesce((target_class.settings -> 'students' ->> 'requireJoinApproval')::boolean, false) then 'pending'
    else 'approved'
  end;

  insert into public.class_memberships (class_id, user_id, role, status, email, approved_at)
  values (
    target_class.id,
    auth.uid(),
    'student',
    next_status,
    requester_email,
    case when next_status = 'approved' then now() else null end
  )
  on conflict (class_id, user_id)
  do update set
    email = excluded.email,
    status = next_status,
    approved_at = case when next_status = 'approved' then coalesce(public.class_memberships.approved_at, now()) else null end;

  insert into public.profiles (user_id, class_id, role, display_name)
  values (auth.uid(), target_class.id, 'student', coalesce(auth.jwt() ->> 'name', auth.jwt() -> 'user_metadata' ->> 'name'))
  on conflict (user_id)
  do update set class_id = excluded.class_id, updated_at = now();

  return query select target_class.id, target_class.name, target_class.class_code, next_status;
end;
$$;

revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;
