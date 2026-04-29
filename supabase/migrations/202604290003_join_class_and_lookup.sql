create or replace function public.join_class_by_code(join_code_input text)
returns table(class_id uuid, class_name text, class_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class public.classes%rowtype;
begin
  select * into target_class
  from public.classes
  where class_code = upper(trim(join_code_input))
  limit 1;

  if target_class.id is null then
    raise exception 'INVALID_CLASS_CODE';
  end if;

  insert into public.profiles (user_id, class_id, role, display_name)
  values (auth.uid(), target_class.id, 'student', null)
  on conflict (user_id)
  do update set class_id = excluded.class_id, updated_at = now();

  return query select target_class.id, target_class.name, target_class.class_code;
end;
$$;

revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;
