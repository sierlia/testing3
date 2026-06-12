create or replace function public.delete_class_workspace(target_class uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  requester uuid := auth.uid();
  class_row public.classes%rowtype;
  next_class_id uuid;
  next_class_name text;
begin
  if requester is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if target_class is null then
    raise exception 'CLASS_REQUIRED';
  end if;

  select *
  into class_row
  from public.classes
  where id = target_class;

  if class_row.id is null then
    raise exception 'CLASS_NOT_FOUND';
  end if;

  if not public.is_class_teacher(target_class) then
    raise exception 'NOT_ALLOWED';
  end if;

  delete from storage.objects
  where bucket_id = 'simulation-pdfs'
    and (storage.foldername(name))[1] = target_class::text;

  delete from public.classes
  where id = target_class;

  select c.id, c.name
  into next_class_id, next_class_name
  from public.classes c
  where c.teacher_id = requester
     or exists (
       select 1
       from public.class_memberships m
       where m.class_id = c.id
         and m.user_id = requester
         and m.role = 'teacher'
         and coalesce(m.status, 'approved') = 'approved'
     )
  order by c.created_at desc
  limit 1;

  if next_class_id is not null then
    insert into public.profiles (user_id, class_id, role, display_name, updated_at)
    values (
      requester,
      next_class_id,
      'teacher',
      coalesce(auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email'),
      now()
    )
    on conflict (user_id) do update
      set class_id = excluded.class_id,
          role = 'teacher',
          updated_at = now();
  end if;

  return jsonb_build_object(
    'deletedClassId', target_class,
    'deletedClassName', class_row.name,
    'nextClassId', next_class_id,
    'nextClassName', next_class_name
  );
end;
$$;

revoke all on function public.delete_class_workspace(uuid) from public;
grant execute on function public.delete_class_workspace(uuid) to authenticated;
