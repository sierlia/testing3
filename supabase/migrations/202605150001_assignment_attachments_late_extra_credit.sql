-- Assignment creation refinements: teacher-provided simulation attachments and
-- late-submission preference. Rubric extra-credit data is stored in rubric JSON.

alter table public.class_tasks
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists allow_late_submissions boolean not null default true;
