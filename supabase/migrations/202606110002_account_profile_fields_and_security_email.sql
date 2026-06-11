-- Account profile fields and password-change security email queue.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists schools jsonb not null default '[]'::jsonb;

create table if not exists public.account_security_email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  recipient_email text not null,
  event_type text not null check (event_type in ('password_changed')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists account_security_email_queue_status_idx
  on public.account_security_email_queue(status, created_at);

alter table public.account_security_email_queue enable row level security;

create or replace function public.queue_account_security_email(event_type_input text)
returns public.account_security_email_queue
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester uuid := auth.uid();
  requester_email text;
  queue_row public.account_security_email_queue%rowtype;
begin
  if requester is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if event_type_input <> 'password_changed' then
    raise exception 'UNSUPPORTED_SECURITY_EMAIL_EVENT';
  end if;

  requester_email := coalesce((select u.email from auth.users u where u.id = requester), auth.jwt() ->> 'email', '');
  if requester_email = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  insert into public.account_security_email_queue (user_id, recipient_email, event_type, payload)
  values (
    requester,
    requester_email,
    event_type_input,
    jsonb_build_object('changed_at', now())
  )
  returning * into queue_row;

  return queue_row;
end;
$$;

revoke all on function public.queue_account_security_email(text) from public;
grant execute on function public.queue_account_security_email(text) to authenticated;
