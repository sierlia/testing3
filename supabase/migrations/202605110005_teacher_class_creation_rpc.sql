-- Repair teacher class creation by making ownership server-side and re-asserting
-- the direct insert RLS policy for authenticated users creating their own class.

drop policy if exists "teachers can create classes" on public.classes;
create policy "teachers can create classes"
on public.classes
for insert
to authenticated
with check (
  auth.uid() is not null
  and teacher_id = auth.uid()
);

create or replace function public.create_class_for_teacher(
  class_name text,
  class_code text,
  class_settings jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := trim(coalesce(class_name, ''));
  normalized_code text := upper(trim(coalesce(class_code, '')));
  created_class_id uuid;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if normalized_name = '' then
    raise exception 'CLASS_NAME_REQUIRED';
  end if;

  if normalized_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'CLASS_CODE_INVALID';
  end if;

  insert into public.classes (teacher_id, name, class_code, settings)
  values (current_user_id, normalized_name, normalized_code, coalesce(class_settings, '{}'::jsonb))
  returning id into created_class_id;

  return created_class_id;
end;
$$;

revoke all on function public.create_class_for_teacher(text, text, jsonb) from public;
grant execute on function public.create_class_for_teacher(text, text, jsonb) to authenticated;
