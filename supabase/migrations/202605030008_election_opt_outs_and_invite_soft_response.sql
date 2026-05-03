create table if not exists public.party_leadership_opt_outs (
  party_id uuid not null references public.parties(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position text not null check (position in ('chair','whip')),
  created_at timestamptz not null default now(),
  primary key (party_id, user_id, position)
);

create table if not exists public.committee_leadership_opt_outs (
  committee_id uuid not null references public.committees(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position text not null check (position in ('chair','ranking_member')),
  created_at timestamptz not null default now(),
  primary key (committee_id, user_id, position)
);

create table if not exists public.class_speaker_opt_outs (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

alter table public.party_leadership_opt_outs enable row level security;
alter table public.committee_leadership_opt_outs enable row level security;
alter table public.class_speaker_opt_outs enable row level security;

drop policy if exists "party members read leadership opt outs" on public.party_leadership_opt_outs;
create policy "party members read leadership opt outs" on public.party_leadership_opt_outs
for select using (class_id = public.my_class_id());

drop policy if exists "party members write own leadership opt outs" on public.party_leadership_opt_outs;
create policy "party members write own leadership opt outs" on public.party_leadership_opt_outs
for insert with check (user_id = auth.uid() and class_id = public.my_class_id());

drop policy if exists "party members delete own leadership opt outs" on public.party_leadership_opt_outs;
create policy "party members delete own leadership opt outs" on public.party_leadership_opt_outs
for delete using (user_id = auth.uid());

drop policy if exists "committee members read leadership opt outs" on public.committee_leadership_opt_outs;
create policy "committee members read leadership opt outs" on public.committee_leadership_opt_outs
for select using (
  exists (select 1 from public.committee_members m where m.committee_id = committee_leadership_opt_outs.committee_id and m.user_id = auth.uid())
  or exists (select 1 from public.classes c where c.id = committee_leadership_opt_outs.class_id and c.teacher_id = auth.uid())
);

drop policy if exists "committee members write own leadership opt outs" on public.committee_leadership_opt_outs;
create policy "committee members write own leadership opt outs" on public.committee_leadership_opt_outs
for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.committee_members m where m.committee_id = committee_leadership_opt_outs.committee_id and m.user_id = auth.uid())
);

drop policy if exists "committee members delete own leadership opt outs" on public.committee_leadership_opt_outs;
create policy "committee members delete own leadership opt outs" on public.committee_leadership_opt_outs
for delete using (user_id = auth.uid());

drop policy if exists "class members read speaker opt outs" on public.class_speaker_opt_outs;
create policy "class members read speaker opt outs" on public.class_speaker_opt_outs
for select using (
  exists (select 1 from public.classes c where c.id = class_speaker_opt_outs.class_id and c.teacher_id = auth.uid())
  or exists (
    select 1 from public.class_memberships m
    where m.class_id = class_speaker_opt_outs.class_id
      and m.user_id = auth.uid()
      and coalesce(m.status, 'approved') = 'approved'
  )
);

drop policy if exists "students write own speaker opt outs" on public.class_speaker_opt_outs;
create policy "students write own speaker opt outs" on public.class_speaker_opt_outs
for insert with check (user_id = auth.uid());

drop policy if exists "students delete own speaker opt outs" on public.class_speaker_opt_outs;
create policy "students delete own speaker opt outs" on public.class_speaker_opt_outs
for delete using (user_id = auth.uid());

drop policy if exists "party candidates delete votes for themselves" on public.party_leadership_votes;
create policy "party candidates delete votes for themselves" on public.party_leadership_votes
for delete using (candidate_user_id = auth.uid());

drop policy if exists "party members delete own leadership votes" on public.party_leadership_votes;
create policy "party members delete own leadership votes" on public.party_leadership_votes
for delete using (voter_user_id = auth.uid());

drop policy if exists "committee candidates delete votes for themselves" on public.committee_leadership_votes;
create policy "committee candidates delete votes for themselves" on public.committee_leadership_votes
for delete using (candidate_user_id = auth.uid());

drop policy if exists "committee members delete own leadership votes" on public.committee_leadership_votes;
create policy "committee members delete own leadership votes" on public.committee_leadership_votes
for delete using (voter_user_id = auth.uid());

drop policy if exists "speaker candidates delete votes for themselves" on public.class_speaker_votes;
create policy "speaker candidates delete votes for themselves" on public.class_speaker_votes
for delete using (candidate_user_id = auth.uid());

create or replace function public.invite_teacher_to_class(target_class uuid, teacher_email text)
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
  normalized_email := lower(trim(teacher_email));
  if normalized_email = '' or normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  select c.name into class_name
  from public.classes c
  where c.id = target_class
    and (
      c.teacher_id = auth.uid()
      or exists (
        select 1 from public.class_memberships m
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
  values (target_class, invited_user, 'teacher', 'invited', normalized_email)
  on conflict (class_id, user_id)
  do update set role = 'teacher', status = 'invited', email = excluded.email;

  insert into public.profiles (user_id, role, display_name)
  values (invited_user, 'teacher', null)
  on conflict (user_id)
  do update set role = 'teacher', updated_at = now();

  perform public.create_notification(
    target_class,
    invited_user,
    auth.uid(),
    'system',
    target_class,
    'class.teacher_invite',
    'Class teacher invitation',
    'You were invited to teach ' || class_name || '.',
    '/teacher/dashboard'
  );

  return invited_user;
end;
$$;
