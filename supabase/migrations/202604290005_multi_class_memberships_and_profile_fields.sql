create table if not exists public.class_memberships (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  created_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

alter table public.class_memberships enable row level security;

create policy "users can read own memberships" on public.class_memberships
for select using (user_id = auth.uid());
create policy "users can insert own memberships" on public.class_memberships
for insert with check (user_id = auth.uid());

alter table public.profiles
  add column if not exists personal_statement text,
  add column if not exists constituency_name text,
  add column if not exists constituency_population integer,
  add column if not exists constituency_cook_pvi text,
  add column if not exists constituency_url text;

create or replace function public.join_class_by_code(join_code_input text)
returns table(joined_class_id uuid, joined_class_name text, joined_class_code text)
language plpgsql
security definer
set search_path = public
as $$
declare target_class public.classes%rowtype;
begin
  select c.* into target_class from public.classes c where c.class_code = upper(trim(join_code_input)) limit 1;
  if target_class.id is null then raise exception 'INVALID_CLASS_CODE'; end if;

  insert into public.class_memberships (class_id, user_id, role)
  values (target_class.id, auth.uid(), 'student')
  on conflict (class_id, user_id) do nothing;

  insert into public.profiles (user_id, class_id, role)
  values (auth.uid(), target_class.id, 'student')
  on conflict (user_id)
  do update set class_id = coalesce(public.profiles.class_id, excluded.class_id), updated_at = now();

  return query select target_class.id, target_class.name, target_class.class_code;
end;
$$;
