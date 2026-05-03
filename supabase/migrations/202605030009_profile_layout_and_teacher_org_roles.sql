drop policy if exists "teachers manage profile sections" on public.class_profile_sections;
create policy "teachers manage profile sections" on public.class_profile_sections
for all using (
  exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  or exists (
    select 1 from public.class_memberships m
    where m.class_id = class_profile_sections.class_id
      and m.user_id = auth.uid()
      and m.role = 'teacher'
      and coalesce(m.status, 'approved') = 'approved'
  )
)
with check (
  exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  or exists (
    select 1 from public.class_memberships m
    where m.class_id = class_profile_sections.class_id
      and m.user_id = auth.uid()
      and m.role = 'teacher'
      and coalesce(m.status, 'approved') = 'approved'
  )
);

drop policy if exists "teachers manage caucus memberships" on public.caucus_members;
create policy "teachers manage caucus memberships" on public.caucus_members
for update using (
  exists (
    select 1
    from public.caucuses ca
    join public.classes c on c.id = ca.class_id
    where ca.id = caucus_members.caucus_id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.caucuses ca
    join public.class_memberships m on m.class_id = ca.class_id
    where ca.id = caucus_members.caucus_id
      and m.user_id = auth.uid()
      and m.role = 'teacher'
      and coalesce(m.status, 'approved') = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.caucuses ca
    join public.classes c on c.id = ca.class_id
    where ca.id = caucus_members.caucus_id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.caucuses ca
    join public.class_memberships m on m.class_id = ca.class_id
    where ca.id = caucus_members.caucus_id
      and m.user_id = auth.uid()
      and m.role = 'teacher'
      and coalesce(m.status, 'approved') = 'approved'
  )
);

create or replace function public.profile_section_work_count(target_class uuid, target_section_key text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.profiles p
  where p.class_id = target_class
    and coalesce(p.role, 'student') <> 'teacher'
    and p.written_responses ? target_section_key
    and nullif(trim(coalesce(p.written_responses ->> target_section_key, '')), '') is not null
    and coalesce(p.written_responses -> target_section_key, 'null'::jsonb) <> 'null'::jsonb
$$;

create or replace function public.delete_profile_section_and_work(target_class uuid, target_section_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    exists (select 1 from public.classes c where c.id = target_class and c.teacher_id = auth.uid())
    or exists (
      select 1 from public.class_memberships m
      where m.class_id = target_class
        and m.user_id = auth.uid()
        and m.role = 'teacher'
        and coalesce(m.status, 'approved') = 'approved'
    )
  ) then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.profiles
  set written_responses = coalesce(written_responses, '{}'::jsonb) - target_section_key,
      updated_at = now()
  where class_id = target_class;

  delete from public.class_profile_sections
  where class_id = target_class
    and section_key = target_section_key;
end;
$$;

grant execute on function public.profile_section_work_count(uuid, text) to authenticated;
grant execute on function public.delete_profile_section_and_work(uuid, text) to authenticated;
