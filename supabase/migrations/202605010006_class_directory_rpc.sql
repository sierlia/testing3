create or replace function public.class_directory(target_class uuid)
returns table(
  user_id uuid,
  display_name text,
  party text,
  constituency_name text,
  avatar_url text,
  role public.app_role
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select exists (
      select 1
      from public.classes c
      where c.id = target_class
        and c.teacher_id = auth.uid()
    ) or exists (
      select 1
      from public.class_memberships m
      where m.class_id = target_class
        and m.user_id = auth.uid()
        and coalesce(m.status, 'approved') = 'approved'
    ) as allowed
  ),
  class_users as (
    select c.teacher_id as user_id, 'teacher'::public.app_role as role
    from public.classes c
    where c.id = target_class
    union
    select m.user_id, m.role
    from public.class_memberships m
    where m.class_id = target_class
      and coalesce(m.status, 'approved') = 'approved'
  )
  select
    cu.user_id,
    p.display_name,
    p.party,
    p.constituency_name,
    p.avatar_url,
    cu.role
  from class_users cu
  left join public.profiles p on p.user_id = cu.user_id
  where (select allowed from authorized)
  order by cu.role asc, coalesce(p.display_name, '') asc, cu.user_id asc
$$;

revoke all on function public.class_directory(uuid) from public;
grant execute on function public.class_directory(uuid) to authenticated;
