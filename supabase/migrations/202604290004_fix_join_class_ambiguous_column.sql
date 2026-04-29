drop function if exists public.join_class_by_code(text);

create or replace function public.join_class_by_code(join_code_input text)
returns table(joined_class_id uuid, joined_class_name text, joined_class_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class public.classes%rowtype;
begin
  select c.* into target_class
  from public.classes c
  where c.class_code = upper(trim(join_code_input))
  limit 1;

  if target_class.id is null then
    raise exception 'INVALID_CLASS_CODE';
  end if;

  insert into public.profiles (user_id, class_id, role, display_name)
  values (auth.uid(), target_class.id, 'student', null)
  on conflict (user_id)
  do update set class_id = excluded.class_id, updated_at = now();

  return query
  select target_class.id, target_class.name, target_class.class_code;
end;
$$;
