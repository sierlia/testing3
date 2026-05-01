alter table public.class_memberships
  alter column status set default 'approved';

update public.class_memberships
set status = 'approved',
    approved_at = coalesce(approved_at, now())
where status is distinct from 'approved';

create or replace function public.join_class_by_code(join_code_input text)
returns table(joined_class_id uuid, joined_class_name text, joined_class_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class public.classes%rowtype;
  requester_email text;
begin
  select c.* into target_class from public.classes c where c.class_code = upper(trim(join_code_input)) limit 1;
  if target_class.id is null then raise exception 'INVALID_CLASS_CODE'; end if;

  requester_email := coalesce(auth.jwt() ->> 'email', '');

  insert into public.class_memberships (class_id, user_id, role, status, email, approved_at)
  values (target_class.id, auth.uid(), 'student', 'approved', requester_email, now())
  on conflict (class_id, user_id)
  do update set
    email = excluded.email,
    status = 'approved',
    approved_at = coalesce(public.class_memberships.approved_at, now());

  insert into public.profiles (user_id, class_id, role, display_name)
  values (auth.uid(), target_class.id, 'student', coalesce(auth.jwt() ->> 'name', auth.jwt() -> 'user_metadata' ->> 'name'))
  on conflict (user_id)
  do update set class_id = excluded.class_id, updated_at = now();

  return query select target_class.id, target_class.name, target_class.class_code;
end;
$$;
