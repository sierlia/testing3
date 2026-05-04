create extension if not exists pgcrypto;

alter table public.classes add column if not exists demo_status text;
alter table public.profiles add column if not exists demo_status text;
alter table public.class_memberships add column if not exists demo_status text;

do $$
declare
  demo_class_id uuid := '00000000-0000-4000-8000-000000000100';
  teacher_one uuid := '00000000-0000-4000-8000-000000000201';
  teacher_two uuid := '00000000-0000-4000-8000-000000000202';
  student_one uuid := '00000000-0000-4000-8000-000000000301';
  student_two uuid := '00000000-0000-4000-8000-000000000302';
  demo_password text := '123456';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_anonymous
  )
  values
    ('00000000-0000-0000-0000-000000000000', teacher_one, 'authenticated', 'authenticated', 'teacher1@gavel.demo', crypt(demo_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Teacher 1","role":"teacher","demo":true}'::jsonb, now(), now(), false),
    ('00000000-0000-0000-0000-000000000000', teacher_two, 'authenticated', 'authenticated', 'teacher2@gavel.demo', crypt(demo_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Teacher 2","role":"teacher","demo":true}'::jsonb, now(), now(), false),
    ('00000000-0000-0000-0000-000000000000', student_one, 'authenticated', 'authenticated', 'student1@gavel.demo', crypt(demo_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Student 1","role":"student","demo":true}'::jsonb, now(), now(), false),
    ('00000000-0000-0000-0000-000000000000', student_two, 'authenticated', 'authenticated', 'student2@gavel.demo', crypt(demo_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Student 2","role":"student","demo":true}'::jsonb, now(), now(), false)
  on conflict (id) do update
    set encrypted_password = excluded.encrypted_password,
        email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
        raw_app_meta_data = excluded.raw_app_meta_data,
        raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = now();

  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (teacher_one, teacher_one::text, teacher_one, jsonb_build_object('sub', teacher_one::text, 'email', 'teacher1@gavel.demo', 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now()),
    (teacher_two, teacher_two::text, teacher_two, jsonb_build_object('sub', teacher_two::text, 'email', 'teacher2@gavel.demo', 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now()),
    (student_one, student_one::text, student_one, jsonb_build_object('sub', student_one::text, 'email', 'student1@gavel.demo', 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now()),
    (student_two, student_two::text, student_two, jsonb_build_object('sub', student_two::text, 'email', 'student2@gavel.demo', 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now())
  on conflict (provider_id, provider) do update
    set identity_data = excluded.identity_data,
        updated_at = now();

  insert into public.classes (id, teacher_id, name, class_code, settings, created_at, demo_status)
  values (
    demo_class_id,
    teacher_one,
    'Gavel Demo',
    'DEMO00',
    jsonb_build_object(
      'class', jsonb_build_object('joinEnabled', false),
      'demo', true
    ),
    now(),
    'demo'
  )
  on conflict (id) do update
    set name = excluded.name,
        class_code = excluded.class_code,
        demo_status = 'demo',
        settings = coalesce(public.classes.settings, '{}'::jsonb) || excluded.settings;

  insert into public.class_memberships (class_id, user_id, role, status, email, approved_at, demo_status)
  values
    (demo_class_id, teacher_one, 'teacher', 'approved', null, now(), 'demo'),
    (demo_class_id, teacher_two, 'teacher', 'approved', null, now(), 'demo'),
    (demo_class_id, student_one, 'student', 'approved', null, now(), 'demo'),
    (demo_class_id, student_two, 'student', 'approved', null, now(), 'demo')
  on conflict (class_id, user_id) do update
    set role = excluded.role,
        status = 'approved',
        email = null,
        approved_at = coalesce(public.class_memberships.approved_at, now()),
        demo_status = 'demo';

  insert into public.profiles (user_id, class_id, role, display_name, demo_status, updated_at)
  values
    (teacher_one, demo_class_id, 'teacher', 'Teacher 1', 'demo', now()),
    (teacher_two, demo_class_id, 'teacher', 'Teacher 2', 'demo', now()),
    (student_one, demo_class_id, 'student', 'Student 1', 'demo', now()),
    (student_two, demo_class_id, 'student', 'Student 2', 'demo', now())
  on conflict (user_id) do update
    set class_id = demo_class_id,
        role = excluded.role,
        display_name = excluded.display_name,
        demo_status = 'demo',
        updated_at = now();
end $$;

create or replace function public.demo_account_credentials(account_key text)
returns table(email text, password text, role text, class_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from (
    values
      ('student1', 'student1@gavel.demo', '123456', 'student', '00000000-0000-4000-8000-000000000100'::uuid),
      ('student2', 'student2@gavel.demo', '123456', 'student', '00000000-0000-4000-8000-000000000100'::uuid),
      ('teacher1', 'teacher1@gavel.demo', '123456', 'teacher', '00000000-0000-4000-8000-000000000100'::uuid),
      ('teacher2', 'teacher2@gavel.demo', '123456', 'teacher', '00000000-0000-4000-8000-000000000100'::uuid)
  ) as accounts(key, email, password, role, class_id)
  where key = lower(trim(account_key))
$$;

revoke all on function public.demo_account_credentials(text) from public;
grant execute on function public.demo_account_credentials(text) to anon, authenticated;
