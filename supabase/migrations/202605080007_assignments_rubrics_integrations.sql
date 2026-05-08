-- Assignments: rubrics, quantitative auto-grading, student submissions, and
-- gradebook integration configuration.

alter table public.class_tasks
  add column if not exists points_possible numeric not null default 100,
  add column if not exists rubric jsonb not null default '[]'::jsonb,
  add column if not exists auto_criteria jsonb not null default '[]'::jsonb,
  add column if not exists integration_targets jsonb not null default '[]'::jsonb;

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.class_tasks(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  auto_scores jsonb not null default '{}'::jsonb,
  manual_score numeric,
  manual_feedback text not null default '',
  status text not null default 'submitted' check (status in ('draft','submitted','returned')),
  submitted_at timestamptz,
  returned_at timestamptz,
  graded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_user_id)
);

create index if not exists assignment_submissions_assignment_idx
  on public.assignment_submissions(assignment_id, status, updated_at desc);

create index if not exists assignment_submissions_student_idx
  on public.assignment_submissions(student_user_id, class_id, updated_at desc);

create table if not exists public.grade_integrations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  provider text not null check (provider in ('synergy','schoology','powerschool','google_classroom')),
  enabled boolean not null default false,
  external_course_id text not null default '',
  external_gradebook_id text not null default '',
  sync_mode text not null default 'manual' check (sync_mode in ('manual','auto_returned')),
  status text not null default 'not_connected',
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (class_id, provider)
);

create table if not exists public.assignment_sync_logs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  assignment_id uuid references public.class_tasks(id) on delete cascade,
  provider text not null check (provider in ('synergy','schoology','powerschool','google_classroom')),
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  message text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists assignment_sync_logs_class_assignment_idx
  on public.assignment_sync_logs(class_id, assignment_id, created_at desc);

alter table public.assignment_submissions enable row level security;
alter table public.grade_integrations enable row level security;
alter table public.assignment_sync_logs enable row level security;

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

drop policy if exists "teachers manage tasks" on public.class_tasks;
create policy "teachers manage tasks" on public.class_tasks
for all
to authenticated
using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));

drop policy if exists "students read own assignment submissions" on public.assignment_submissions;
create policy "students read own assignment submissions" on public.assignment_submissions
for select
to authenticated
using (
  student_user_id = auth.uid()
  or public.is_class_teacher(class_id)
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
  )
);

drop policy if exists "teachers create assignment submission records" on public.assignment_submissions;
create policy "teachers create assignment submission records" on public.assignment_submissions
for insert
to authenticated
with check (
  public.is_class_teacher(class_id)
  and exists (
    select 1
    from public.class_tasks t
    where t.id = assignment_id
      and t.class_id = assignment_submissions.class_id
      and t.task_type = 'assignment'
  )
);

drop policy if exists "students update own assignment submissions" on public.assignment_submissions;
create policy "students update own assignment submissions" on public.assignment_submissions
for update
to authenticated
using (
  student_user_id = auth.uid()
  or public.is_class_teacher(class_id)
)
with check (
  (student_user_id = auth.uid() and class_id = public.my_class_id())
  or public.is_class_teacher(class_id)
);

drop policy if exists "teachers delete assignment submissions" on public.assignment_submissions;
create policy "teachers delete assignment submissions" on public.assignment_submissions
for delete
to authenticated
using (public.is_class_teacher(class_id));

create or replace function public.guard_assignment_submission_student_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  attachment jsonb;
  attachment_href text;
  attachment_type text;
begin
  if public.is_class_teacher(new.class_id) then
    return new;
  end if;

  if auth.uid() is null or new.student_user_id <> auth.uid() then
    raise exception 'ASSIGNMENT_SUBMISSION_OWNER_DENIED';
  end if;

  if tg_op = 'UPDATE' then
    if new.assignment_id is distinct from old.assignment_id
      or new.class_id is distinct from old.class_id
      or new.student_user_id is distinct from old.student_user_id then
      raise exception 'ASSIGNMENT_SUBMISSION_CONTEXT_DENIED';
    end if;

    new.manual_score := old.manual_score;
    new.manual_feedback := old.manual_feedback;
    new.returned_at := old.returned_at;
    new.graded_by := old.graded_by;
    new.auto_scores := old.auto_scores;
  else
    new.manual_score := null;
    new.manual_feedback := '';
    new.returned_at := null;
    new.graded_by := null;
    new.auto_scores := '{}'::jsonb;
  end if;

  if new.status = 'returned' then
    raise exception 'ASSIGNMENT_SUBMISSION_RETURN_DENIED';
  end if;

  if length(coalesce(new.body, '')) > 20000 then
    raise exception 'ASSIGNMENT_SUBMISSION_BODY_TOO_LONG';
  end if;

  if jsonb_typeof(coalesce(new.attachments, '[]'::jsonb)) <> 'array' then
    raise exception 'ASSIGNMENT_SUBMISSION_ATTACHMENTS_INVALID';
  end if;

  if jsonb_array_length(coalesce(new.attachments, '[]'::jsonb)) > 30 then
    raise exception 'ASSIGNMENT_SUBMISSION_ATTACHMENTS_TOO_MANY';
  end if;

  for attachment in select value from jsonb_array_elements(coalesce(new.attachments, '[]'::jsonb))
  loop
    attachment_href := coalesce(attachment ->> 'href', '');
    attachment_type := coalesce(attachment ->> 'type', '');
    if jsonb_typeof(attachment) <> 'object'
      or attachment_type not in ('bill','cosponsored_bill','letter','profile')
      or coalesce(attachment ->> 'id', '') = ''
      or length(coalesce(attachment ->> 'label', '')) > 240
      or attachment_href !~ '^/[A-Za-z0-9?&=_%#:/.-]*$'
      or attachment_href like '//%' then
      raise exception 'ASSIGNMENT_SUBMISSION_ATTACHMENT_DENIED';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_guard_assignment_submission_student_fields on public.assignment_submissions;
create trigger trg_guard_assignment_submission_student_fields
before insert or update on public.assignment_submissions
for each row execute function public.guard_assignment_submission_student_fields();

drop policy if exists "teachers read grade integrations" on public.grade_integrations;
create policy "teachers read grade integrations" on public.grade_integrations
for select
to authenticated
using (public.is_class_teacher(class_id));

drop policy if exists "teachers manage grade integrations" on public.grade_integrations;
create policy "teachers manage grade integrations" on public.grade_integrations
for all
to authenticated
using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));

drop policy if exists "teachers read assignment sync logs" on public.assignment_sync_logs;
create policy "teachers read assignment sync logs" on public.assignment_sync_logs
for select
to authenticated
using (public.is_class_teacher(class_id));

drop policy if exists "teachers create assignment sync logs" on public.assignment_sync_logs;
create policy "teachers create assignment sync logs" on public.assignment_sync_logs
for insert
to authenticated
with check (public.is_class_teacher(class_id));

drop trigger if exists trg_touch_assignment_submissions on public.assignment_submissions;
create trigger trg_touch_assignment_submissions
before update on public.assignment_submissions
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_grade_integrations on public.grade_integrations;
create trigger trg_touch_grade_integrations
before update on public.grade_integrations
for each row execute function public.touch_updated_at();
