-- Student class switching and account deletion workflow.

create or replace function public.join_class_by_code(join_code_input text)
returns table(joined_class_id uuid, joined_class_name text, joined_class_code text, joined_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class public.classes%rowtype;
  requester_email text;
  existing_status text;
  next_status text;
begin
  select c.* into target_class from public.classes c where c.class_code = upper(trim(join_code_input)) limit 1;
  if target_class.id is null then raise exception 'INVALID_CLASS_CODE'; end if;
  if not coalesce((target_class.settings -> 'class' ->> 'joinEnabled')::boolean, false) then
    raise exception 'CLASS_NOT_OPEN';
  end if;

  requester_email := coalesce(auth.jwt() ->> 'email', '');
  select m.status into existing_status
  from public.class_memberships m
  where m.class_id = target_class.id
    and m.user_id = auth.uid()
  limit 1;

  next_status := case
    when existing_status = 'approved' then 'approved'
    when coalesce((target_class.settings -> 'students' ->> 'requireJoinApproval')::boolean, false) then 'pending'
    else 'approved'
  end;

  insert into public.class_memberships (class_id, user_id, role, status, email, approved_at)
  values (
    target_class.id,
    auth.uid(),
    'student',
    next_status,
    requester_email,
    case when next_status = 'approved' then now() else null end
  )
  on conflict (class_id, user_id)
  do update set
    email = excluded.email,
    status = next_status,
    approved_at = case when next_status = 'approved' then coalesce(public.class_memberships.approved_at, now()) else public.class_memberships.approved_at end;

  if next_status = 'approved' then
    insert into public.profiles (user_id, class_id, role, display_name)
    values (auth.uid(), target_class.id, 'student', coalesce(auth.jwt() ->> 'name', auth.jwt() -> 'user_metadata' ->> 'name'))
    on conflict (user_id)
    do update set class_id = excluded.class_id, role = excluded.role, updated_at = now();
  else
    insert into public.profiles (user_id, class_id, role, display_name)
    values (auth.uid(), null, 'student', coalesce(auth.jwt() ->> 'name', auth.jwt() -> 'user_metadata' ->> 'name'))
    on conflict (user_id)
    do update set updated_at = now();
  end if;

  return query select target_class.id, target_class.name, target_class.class_code, next_status;
end;
$$;

revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;

create or replace function public.invite_student_to_class(target_class uuid, student_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invited_user uuid;
  normalized_email text;
  class_name text;
begin
  normalized_email := lower(trim(student_email));
  if normalized_email = '' or normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  select c.name into class_name
  from public.classes c
  where c.id = target_class
    and (
      c.teacher_id = auth.uid()
      or exists (
        select 1
        from public.class_memberships m
        where m.class_id = c.id
          and m.user_id = auth.uid()
          and m.role = 'teacher'
          and coalesce(m.status, 'approved') = 'approved'
      )
    );
  if class_name is null then
    raise exception 'NOT_ALLOWED';
  end if;

  select u.id into invited_user
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;
  if invited_user is null then
    return null;
  end if;

  insert into public.class_memberships (class_id, user_id, role, status, email)
  values (target_class, invited_user, 'student', 'invited', normalized_email)
  on conflict (class_id, user_id)
  do update set role = 'student', status = 'invited', email = excluded.email;

  insert into public.profiles (user_id, role, display_name)
  values (invited_user, 'student', null)
  on conflict (user_id)
  do update set role = 'student', updated_at = now();

  perform public.create_notification(
    target_class,
    invited_user,
    auth.uid(),
    'system',
    target_class,
    'class.student_invite',
    'Class invitation',
    'You were invited to join ' || class_name || '.',
    '/my-classes'
  );

  return invited_user;
end;
$$;

revoke all on function public.invite_student_to_class(uuid, text) from public;
grant execute on function public.invite_student_to_class(uuid, text) to authenticated;

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  status text not null default 'pending' check (status in ('pending','cancelled','completed')),
  requested_at timestamptz not null default now(),
  delete_after timestamptz not null default (now() + interval '3 days'),
  cancelled_at timestamptz,
  completed_at timestamptz,
  email_notice_status text not null default 'queued' check (email_notice_status in ('queued','sent','failed')),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_deletion_email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  recipient_email text not null,
  event_type text not null check (event_type in ('account_deletion_requested','account_deletion_cancelled','account_deletion_completed')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists account_deletion_requests_due_idx
  on public.account_deletion_requests(status, delete_after)
  where status = 'pending';

create index if not exists account_deletion_email_queue_status_idx
  on public.account_deletion_email_queue(status, created_at);

alter table public.account_deletion_requests enable row level security;
alter table public.account_deletion_email_queue enable row level security;

drop policy if exists "users read own account deletion request" on public.account_deletion_requests;
create policy "users read own account deletion request"
on public.account_deletion_requests
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.request_account_deletion()
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester uuid := auth.uid();
  requester_email text;
  request_row public.account_deletion_requests%rowtype;
begin
  if requester is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  requester_email := coalesce((select u.email from auth.users u where u.id = requester), auth.jwt() ->> 'email', '');

  insert into public.account_deletion_requests (
    user_id,
    email,
    status,
    requested_at,
    delete_after,
    cancelled_at,
    completed_at,
    email_notice_status,
    updated_at
  )
  values (
    requester,
    requester_email,
    'pending',
    now(),
    now() + interval '3 days',
    null,
    null,
    'queued',
    now()
  )
  on conflict (user_id)
  do update set
    email = excluded.email,
    status = 'pending',
    requested_at = excluded.requested_at,
    delete_after = excluded.delete_after,
    cancelled_at = null,
    completed_at = null,
    email_notice_status = 'queued',
    updated_at = now()
  returning * into request_row;

  insert into public.account_deletion_email_queue (user_id, recipient_email, event_type, payload)
  values (
    requester,
    requester_email,
    'account_deletion_requested',
    jsonb_build_object('delete_after', request_row.delete_after)
  );

  return request_row;
end;
$$;

create or replace function public.cancel_account_deletion()
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester uuid := auth.uid();
  requester_email text;
  request_row public.account_deletion_requests%rowtype;
begin
  if requester is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  requester_email := coalesce((select u.email from auth.users u where u.id = requester), auth.jwt() ->> 'email', '');

  update public.account_deletion_requests
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where user_id = requester
    and status = 'pending'
  returning * into request_row;

  if request_row.user_id is null then
    raise exception 'NO_PENDING_DELETION_REQUEST';
  end if;

  insert into public.account_deletion_email_queue (user_id, recipient_email, event_type, payload)
  values (
    requester,
    requester_email,
    'account_deletion_cancelled',
    jsonb_build_object('cancelled_at', request_row.cancelled_at)
  );

  return request_row;
end;
$$;

create or replace function public.process_due_account_deletions(batch_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  request_row public.account_deletion_requests%rowtype;
  completed_count integer := 0;
begin
  for request_row in
    select *
    from public.account_deletion_requests
    where status = 'pending'
      and delete_after <= now()
    order by delete_after asc
    limit greatest(1, least(coalesce(batch_limit, 50), 200))
    for update skip locked
  loop
    update public.account_deletion_requests
    set status = 'completed',
        completed_at = now(),
        updated_at = now()
    where user_id = request_row.user_id;

    insert into public.account_deletion_email_queue (user_id, recipient_email, event_type, payload)
    values (
      request_row.user_id,
      coalesce(request_row.email, ''),
      'account_deletion_completed',
      jsonb_build_object('completed_at', now())
    );

    delete from auth.users where id = request_row.user_id;
    completed_count := completed_count + 1;
  end loop;

  return completed_count;
end;
$$;

revoke all on function public.request_account_deletion() from public;
revoke all on function public.cancel_account_deletion() from public;
revoke all on function public.process_due_account_deletions(integer) from public;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.process_due_account_deletions(integer) to service_role;
