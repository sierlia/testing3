create extension if not exists pgcrypto;

create or replace function public.purge_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  demo_class_id uuid := '00000000-0000-4000-8000-000000000100';
  teacher_one uuid := '00000000-0000-4000-8000-000000000201';
  teacher_two uuid := '00000000-0000-4000-8000-000000000202';
  student_one uuid := '00000000-0000-4000-8000-000000000301';
  student_two uuid := '00000000-0000-4000-8000-000000000302';
  demo_password text := '123456';
  demo_teacher_ids uuid[] := array[
    '00000000-0000-4000-8000-000000000201'::uuid,
    '00000000-0000-4000-8000-000000000202'::uuid
  ];
  demo_user_ids uuid[] := array[
    '00000000-0000-4000-8000-000000000201'::uuid,
    '00000000-0000-4000-8000-000000000202'::uuid,
    '00000000-0000-4000-8000-000000000301'::uuid,
    '00000000-0000-4000-8000-000000000302'::uuid
  ];
  default_committees text[] := array[
    'Agriculture',
    'Appropriations',
    'Armed Services',
    'Budget',
    'Education and Workforce'
  ];
  default_subcommittee_keys text[] := array[
    'Agriculture::Commodity Markets, Digital Assets, and Rural Development',
    'Agriculture::Conservation, Research, and Biotechnology',
    'Agriculture::Forestry and Horticulture',
    'Agriculture::General Farm Commodities, Risk Management, and Credit',
    'Agriculture::Livestock, Dairy, and Poultry',
    'Agriculture::Nutrition and Foreign Agriculture',
    'Appropriations::Agriculture, Rural Development, Food and Drug Administration, and Related Agencies',
    'Appropriations::Commerce, Justice, Science, and Related Agencies',
    'Appropriations::Defense',
    'Appropriations::Energy and Water Development and Related Agencies',
    'Appropriations::Financial Services and General Government',
    'Appropriations::Homeland Security',
    'Appropriations::Interior, Environment, and Related Agencies',
    'Appropriations::Labor, Health and Human Services, Education, and Related Agencies',
    'Appropriations::Legislative Branch',
    'Appropriations::Military Construction, Veterans Affairs, and Related Agencies',
    'Appropriations::National Security, Department of State, and Related Programs',
    'Appropriations::Transportation, Housing and Urban Development, and Related Agencies',
    'Armed Services::Cyber, Information Technologies, and Innovation',
    'Armed Services::Intelligence and Special Operations',
    'Armed Services::Military Personnel',
    'Armed Services::Readiness',
    'Armed Services::Seapower and Projection Forces',
    'Armed Services::Strategic Forces',
    'Armed Services::Tactical Air and Land Forces',
    'Education and Workforce::Early Childhood, Elementary, and Secondary Education',
    'Education and Workforce::Health, Employment, Labor, and Pensions',
    'Education and Workforce::Higher Education and Workforce Development',
    'Education and Workforce::Workforce Protections'
  ];
  reset_class_ids uuid[];
  extra_class_ids uuid[];
  default_settings jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  default_settings := jsonb_build_object(
    'description', '',
    'demo', true,
    'class', jsonb_build_object('joinEnabled', false),
    'students', jsonb_build_object('requireJoinApproval', false),
    'workflow', jsonb_build_object('stage', 'setup'),
    'parties', jsonb_build_object(
      'allowed', to_jsonb(array['Democratic Party', 'Republican Party']::text[]),
      'allowStudentCreated', false,
      'requireApproval', true
    ),
    'committees', jsonb_build_object(
      'enabled', to_jsonb(default_committees),
      'subcommitteesEnabled', true,
      'enabledSubcommittees', to_jsonb(default_subcommittee_keys),
      'assignmentMode', 'preference',
      'allowSelfJoin', false,
      'chairElectionMode', 'elected',
      'chairVoteThresholdPct', 50
    ),
    'bills', jsonb_build_object(
      'enabled', true,
      'tabs', to_jsonb(array['legislative text', 'supporting text']::text[]),
      'assignmentAuthority', 'teacher',
      'assignmentAuthorityMode', 'teacher',
      'allowDrafts', true,
      'committeeVoteRequired', true,
      'votedAfterCommittee', true,
      'cosponsorshipMode', 'always',
      'cosponsorAfterCommitteeReport', false,
      'showCosponsors', true
    ),
    'floor', jsonb_build_object(
      'enabled', true,
      'binding', true,
      'calendarAutoPublish', true,
      'speakerSignupMode', 'open',
      'voteThreshold', 'simple-majority',
      'voteThresholdPct', 50,
      'showVoteResultsLive', true
    ),
    'organizations', jsonb_build_object(
      'enabled', true,
      'creationAllowed', true,
      'enableParties', true,
      'enableCommittees', true,
      'enableCaucuses', true,
      'enableLobbyists', false,
      'announcementBoards', jsonb_build_object('enabled', true, 'comments', true, 'emotes', true)
    ),
    'elections', jsonb_build_object(
      'enabled', true,
      'houseLeadership', jsonb_build_object('enabled', true, 'mode', 'student-vote'),
      'organizations', jsonb_build_object('enabled', true, 'mode', 'student-vote')
    ),
    'profiles', jsonb_build_object(
      'enabled', true,
      'editingAllowed', true,
      'editingMode', 'all',
      'districtRequired', true,
      'partyRequired', true
    ),
    'notifications', jsonb_build_object('announcements', true, 'calendaredBills', true),
    'automation', jsonb_build_object(
      'selfSufficiencyMode', 'teacher-initiated',
      'autoOpenVotes', false,
      'autoCloseVotes', false,
      'autoCloseVoteParticipationPct', 75
    ),
    'records', jsonb_build_object('types', to_jsonb(array['record', 'resolution', 'statement']::text[])),
    'money', jsonb_build_object(
      'enabled', false,
      'startingAmount', 1000,
      'committeeDashboardAccessPrice', 100,
      'committeeReviewAccessPrice', 250
    ),
    'lobbyists', jsonb_build_object('enabled', false, 'joinMode', 'free_join', 'startingAmount', 1000),
    'editorFormats', jsonb_build_object(
      'billComposer', 'editor',
      'committeeRevisedText', 'editor',
      'committeeReport', 'editor',
      'profile', 'editor'
    ),
    'wordLimits', jsonb_build_object(
      'profileLongResponse', 1000,
      'bill', 5000,
      'committeeReport', 2000,
      'organizationName', 100,
      'organizationDescription', 500,
      'announcement', 1000,
      'comment', 500
    )
  );

  select coalesce(array_agg(c.id), array[]::uuid[])
  into extra_class_ids
  from public.classes c
  where c.id <> demo_class_id
    and (
      c.teacher_id = any(demo_teacher_ids)
      or c.demo_status = 'demo'
    );

  reset_class_ids := array_prepend(demo_class_id, extra_class_ids);

  delete from public.classes
  where id = any(extra_class_ids);

  delete from public.class_memberships
  where user_id = any(demo_user_ids)
    and class_id <> demo_class_id;

  delete from public.notifications
  where class_id = demo_class_id
    or recipient_user_id = any(demo_user_ids)
    or actor_user_id = any(demo_user_ids);

  delete from public.account_deletion_requests
  where user_id = any(demo_user_ids);

  delete from public.account_deletion_email_queue
  where user_id = any(demo_user_ids)
    or lower(recipient_email) in ('teacher1@gavel.demo', 'teacher2@gavel.demo', 'student1@gavel.demo', 'student2@gavel.demo');

  delete from public.account_security_email_queue
  where user_id = any(demo_user_ids)
    or lower(recipient_email) in ('teacher1@gavel.demo', 'teacher2@gavel.demo', 'student1@gavel.demo', 'student2@gavel.demo');

  delete from public.help_messages
  where user_id = any(demo_user_ids)
    or lower(email) in ('teacher1@gavel.demo', 'teacher2@gavel.demo', 'student1@gavel.demo', 'student2@gavel.demo');

  delete from public.assignment_sync_logs where class_id = demo_class_id;
  delete from public.assignment_submissions where class_id = demo_class_id;
  delete from public.grade_integrations where class_id = demo_class_id;
  delete from public.class_tasks where class_id = demo_class_id;
  delete from public.class_announcements where class_id = demo_class_id;
  delete from public.dear_colleague_letters where class_id = demo_class_id;
  delete from public.floor_discussion_areas where class_id = demo_class_id;
  delete from public.lobbyist_contributions where class_id = demo_class_id;
  delete from public.newsletter_ad_bids where class_id = demo_class_id;
  delete from public.custom_records where class_id = demo_class_id;
  delete from public.class_speaker_votes where class_id = demo_class_id;
  delete from public.class_speaker_opt_outs where class_id = demo_class_id;
  delete from public.class_president_votes where class_id = demo_class_id;
  delete from public.committee_preference_submissions where class_id = demo_class_id;
  delete from public.committee_preferences where class_id = demo_class_id;
  delete from public.bills where class_id = demo_class_id;
  delete from public.caucuses where class_id = demo_class_id;
  delete from public.lobbyist_groups where class_id = demo_class_id;
  delete from public.parties where class_id = demo_class_id;
  delete from public.committees where class_id = demo_class_id;
  delete from public.class_profile_sections where class_id = demo_class_id;
  delete from public.class_memberships where class_id = demo_class_id;

  update public.profiles
  set class_id = null,
      updated_at = now()
  where class_id = demo_class_id
    and user_id <> all(demo_user_ids);

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_anonymous
  )
  values
    ('00000000-0000-0000-0000-000000000000', teacher_one, 'authenticated', 'authenticated', 'teacher1@gavel.demo', crypt(demo_password, gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Teacher 1","first_name":"Teacher","last_name":"1","role":"teacher","demo":true,"schools":[]}'::jsonb, now(), now(), false),
    ('00000000-0000-0000-0000-000000000000', teacher_two, 'authenticated', 'authenticated', 'teacher2@gavel.demo', crypt(demo_password, gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Teacher 2","first_name":"Teacher","last_name":"2","role":"teacher","demo":true,"schools":[]}'::jsonb, now(), now(), false),
    ('00000000-0000-0000-0000-000000000000', student_one, 'authenticated', 'authenticated', 'student1@gavel.demo', crypt(demo_password, gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Student 1","first_name":"Student","last_name":"1","role":"student","demo":true,"schools":[]}'::jsonb, now(), now(), false),
    ('00000000-0000-0000-0000-000000000000', student_two, 'authenticated', 'authenticated', 'student2@gavel.demo', crypt(demo_password, gen_salt('bf')), now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Student 2","first_name":"Student","last_name":"2","role":"student","demo":true,"schools":[]}'::jsonb, now(), now(), false)
  on conflict (id) do update
    set email = excluded.email,
        encrypted_password = excluded.encrypted_password,
        email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
        confirmation_token = '',
        email_change = '',
        email_change_token_new = '',
        recovery_token = '',
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
    set user_id = excluded.user_id,
        identity_data = excluded.identity_data,
        updated_at = now();

  insert into public.classes (id, teacher_id, name, class_code, settings, created_at, demo_status)
  values (demo_class_id, teacher_one, 'Gavel Demo', 'DEMO00', default_settings, now(), 'demo')
  on conflict (id) do update
    set teacher_id = excluded.teacher_id,
        name = excluded.name,
        class_code = excluded.class_code,
        settings = excluded.settings,
        demo_status = 'demo';

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
        approved_at = now(),
        demo_status = 'demo';

  insert into public.profiles (
    user_id,
    class_id,
    role,
    display_name,
    first_name,
    last_name,
    schools,
    party,
    district_slug,
    onboarding,
    constituency_name,
    constituency_population,
    constituency_cook_pvi,
    constituency_url,
    written_responses,
    avatar_url,
    notification_prefs,
    demo_status,
    profile_pdf_path,
    updated_at
  )
  values
    (teacher_one, demo_class_id, 'teacher', 'Teacher 1', 'Teacher', '1', '[]'::jsonb, null, null, '{}'::jsonb, null, null, null, null, '{}'::jsonb, null, '{}'::jsonb, 'demo', null, now()),
    (teacher_two, demo_class_id, 'teacher', 'Teacher 2', 'Teacher', '2', '[]'::jsonb, null, null, '{}'::jsonb, null, null, null, null, '{}'::jsonb, null, '{}'::jsonb, 'demo', null, now()),
    (student_one, demo_class_id, 'student', 'Student 1', 'Student', '1', '[]'::jsonb, null, null, '{}'::jsonb, null, null, null, null, '{}'::jsonb, null, '{}'::jsonb, 'demo', null, now()),
    (student_two, demo_class_id, 'student', 'Student 2', 'Student', '2', '[]'::jsonb, null, null, '{}'::jsonb, null, null, null, null, '{}'::jsonb, null, '{}'::jsonb, 'demo', null, now())
  on conflict (user_id) do update
    set class_id = excluded.class_id,
        role = excluded.role,
        display_name = excluded.display_name,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        schools = excluded.schools,
        party = null,
        district_slug = null,
        onboarding = '{}'::jsonb,
        constituency_name = null,
        constituency_population = null,
        constituency_cook_pvi = null,
        constituency_url = null,
        written_responses = '{}'::jsonb,
        avatar_url = null,
        notification_prefs = '{}'::jsonb,
        demo_status = 'demo',
        profile_pdf_path = null,
        updated_at = now();

  insert into public.parties (class_id, name, platform, created_by, approved, color)
  values
    (demo_class_id, 'Democratic Party', '', teacher_one, true, '#2563eb'),
    (demo_class_id, 'Republican Party', '', teacher_one, true, '#dc2626');

  insert into public.committees (class_id, name, description)
  select demo_class_id, name, ''
  from unnest(default_committees) as committees(name);

  insert into public.subcommittees (committee_id, class_id, name, description)
  select c.id,
         demo_class_id,
         split_part(key_value, '::', 2),
         ''
  from public.committees c
  join unnest(default_subcommittee_keys) as default_keys(key_value)
    on split_part(key_value, '::', 1) = c.name
  where c.class_id = demo_class_id;

  return jsonb_build_object(
    'defaultClassId', demo_class_id,
    'deletedExtraClasses', cardinality(extra_class_ids),
    'resetClassCount', cardinality(reset_class_ids),
    'resetAt', now()
  );
end;
$$;

revoke all on function public.purge_demo_data() from public;
grant execute on function public.purge_demo_data() to authenticated;

create or replace function public.delete_class_workspace(target_class uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester uuid := auth.uid();
  class_row public.classes%rowtype;
  next_class_id uuid;
  next_class_name text;
begin
  if requester is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if target_class is null then
    raise exception 'CLASS_REQUIRED';
  end if;

  select *
  into class_row
  from public.classes
  where id = target_class;

  if class_row.id is null then
    raise exception 'CLASS_NOT_FOUND';
  end if;

  if not public.is_class_teacher(target_class) then
    raise exception 'NOT_ALLOWED';
  end if;

  delete from public.classes
  where id = target_class;

  select c.id, c.name
  into next_class_id, next_class_name
  from public.classes c
  where c.teacher_id = requester
     or exists (
       select 1
       from public.class_memberships m
       where m.class_id = c.id
         and m.user_id = requester
         and m.role = 'teacher'
         and coalesce(m.status, 'approved') = 'approved'
     )
  order by c.created_at desc
  limit 1;

  if next_class_id is not null then
    insert into public.profiles (user_id, class_id, role, display_name, updated_at)
    values (
      requester,
      next_class_id,
      'teacher',
      coalesce(auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email'),
      now()
    )
    on conflict (user_id) do update
      set class_id = excluded.class_id,
          role = 'teacher',
          updated_at = now();
  end if;

  return jsonb_build_object(
    'deletedClassId', target_class,
    'deletedClassName', class_row.name,
    'nextClassId', next_class_id,
    'nextClassName', next_class_name
  );
end;
$$;

revoke all on function public.delete_class_workspace(uuid) from public;
grant execute on function public.delete_class_workspace(uuid) to authenticated;
