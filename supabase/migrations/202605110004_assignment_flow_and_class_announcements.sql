-- Assignment flow refinements: selected-student targeting, grading mode, and
-- class-level announcements with teacher pinning.

alter table public.class_tasks
  add column if not exists audience_user_ids jsonb not null default '[]'::jsonb,
  add column if not exists grading_mode text not null default 'manual',
  add column if not exists manual_submission_required boolean not null default true;

alter table public.class_tasks
  drop constraint if exists class_tasks_audience_type_check;

alter table public.class_tasks
  add constraint class_tasks_audience_type_check
  check (audience_type in ('all','party','committee','caucus','selected_students'));

alter table public.class_tasks
  drop constraint if exists class_tasks_grading_mode_check;

alter table public.class_tasks
  add constraint class_tasks_grading_mode_check
  check (grading_mode in ('manual','auto'));

create index if not exists class_tasks_selected_students_idx
  on public.class_tasks using gin (audience_user_ids);

drop policy if exists "class members read tasks" on public.class_tasks;
create policy "class members read tasks" on public.class_tasks
for select
to authenticated
using (
  public.is_class_teacher(class_id)
  or (
    class_id = public.my_class_id()
    and (
      audience_type = 'all'
      or (
        audience_type = 'selected_students'
        and audience_user_ids ? auth.uid()::text
      )
      or (
        audience_type = 'party'
        and exists (
          select 1
          from public.parties pa
          join public.profiles p on p.user_id = auth.uid()
          where pa.id = audience_id
            and pa.class_id = public.class_tasks.class_id
            and p.class_id = public.class_tasks.class_id
            and p.party = pa.name
        )
      )
      or (
        audience_type = 'committee'
        and exists (
          select 1
          from public.committee_members m
          where m.user_id = auth.uid()
            and m.committee_id = audience_id
        )
      )
      or (
        audience_type = 'caucus'
        and exists (
          select 1
          from public.caucus_members m
          where m.user_id = auth.uid()
            and m.caucus_id = audience_id
        )
      )
    )
  )
);

drop policy if exists "students submit own assignments" on public.assignment_submissions;
create policy "students submit own assignments" on public.assignment_submissions
for insert
to authenticated
with check (
  student_user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (
    select 1
    from public.class_tasks t
    where t.id = assignment_id
      and t.class_id = assignment_submissions.class_id
      and t.task_type = 'assignment'
      and (
        t.audience_type = 'all'
        or (
          t.audience_type = 'selected_students'
          and t.audience_user_ids ? auth.uid()::text
        )
        or (
          t.audience_type = 'party'
          and exists (
            select 1
            from public.parties pa
            join public.profiles p on p.user_id = auth.uid()
            where pa.id = t.audience_id
              and pa.class_id = t.class_id
              and p.class_id = t.class_id
              and p.party = pa.name
          )
        )
        or (
          t.audience_type = 'committee'
          and exists (
            select 1
            from public.committee_members m
            where m.user_id = auth.uid()
              and m.committee_id = t.audience_id
          )
        )
        or (
          t.audience_type = 'caucus'
          and exists (
            select 1
            from public.caucus_members m
            where m.user_id = auth.uid()
              and m.caucus_id = t.audience_id
          )
        )
      )
  )
);

create table if not exists public.class_announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists class_announcements_class_created_idx
  on public.class_announcements(class_id, is_pinned desc, created_at desc);

alter table public.class_announcements enable row level security;

drop policy if exists "class members read class announcements" on public.class_announcements;
create policy "class members read class announcements"
on public.class_announcements
for select
to authenticated
using (class_id = public.my_class_id() or public.is_class_teacher(class_id));

drop policy if exists "teachers manage class announcements" on public.class_announcements;
create policy "teachers manage class announcements"
on public.class_announcements
for all
to authenticated
using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));

drop trigger if exists trg_touch_class_announcements on public.class_announcements;
create trigger trg_touch_class_announcements
before update on public.class_announcements
for each row execute function public.touch_updated_at();
