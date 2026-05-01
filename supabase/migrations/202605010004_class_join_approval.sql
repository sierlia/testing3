alter table public.class_memberships
  add column if not exists status text not null default 'approved',
  add column if not exists email text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id);

update public.class_memberships
set status = 'approved'
where status is null;

drop policy if exists "teachers can read class memberships" on public.class_memberships;
create policy "teachers can read class memberships" on public.class_memberships
for select using (
  exists (
    select 1 from public.classes c
    where c.id = class_memberships.class_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers can update class memberships" on public.class_memberships;
create policy "teachers can update class memberships" on public.class_memberships
for update using (
  exists (
    select 1 from public.classes c
    where c.id = class_memberships.class_id
      and c.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.classes c
    where c.id = class_memberships.class_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teachers can delete class memberships" on public.class_memberships;
create policy "teachers can delete class memberships" on public.class_memberships
for delete using (
  exists (
    select 1 from public.classes c
    where c.id = class_memberships.class_id
      and c.teacher_id = auth.uid()
  )
);

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

  insert into public.class_memberships (class_id, user_id, role, status, email)
  values (target_class.id, auth.uid(), 'student', 'pending', requester_email)
  on conflict (class_id, user_id)
  do update set email = excluded.email;

  insert into public.profiles (user_id, role, display_name)
  values (auth.uid(), 'student', coalesce(auth.jwt() ->> 'name', auth.jwt() -> 'user_metadata' ->> 'name'))
  on conflict (user_id)
  do update set updated_at = now();

  return query select target_class.id, target_class.name, target_class.class_code;
end;
$$;
