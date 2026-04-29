-- Fix recursive RLS evaluation on profiles/classes lookups.

create or replace function public.my_class_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select class_id
  from public.profiles
  where user_id = auth.uid()
  limit 1
$$;

revoke all on function public.my_class_id() from public;
grant execute on function public.my_class_id() to authenticated;

drop policy if exists "class members can read classes" on public.classes;
create policy "class members or teacher can read classes"
on public.classes
for select
using (id = public.my_class_id() or teacher_id = auth.uid());

drop policy if exists "class members can read profiles" on public.profiles;
create policy "class members can read profiles"
on public.profiles
for select
using (class_id = public.my_class_id() or user_id = auth.uid());
