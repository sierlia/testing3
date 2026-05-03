create table if not exists public.class_speaker_votes (
  class_id uuid not null references public.classes(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  candidate_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (class_id, voter_user_id)
);

alter table public.class_speaker_votes enable row level security;

drop policy if exists "class members read speaker votes" on public.class_speaker_votes;
create policy "class members read speaker votes" on public.class_speaker_votes
for select using (
  exists (
    select 1 from public.classes c
    where c.id = class_speaker_votes.class_id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1 from public.class_memberships m
    where m.class_id = class_speaker_votes.class_id
      and m.user_id = auth.uid()
      and coalesce(m.status, 'approved') = 'approved'
  )
);

drop policy if exists "students write own speaker votes" on public.class_speaker_votes;
create policy "students write own speaker votes" on public.class_speaker_votes
for insert with check (
  voter_user_id = auth.uid()
  and exists (
    select 1 from public.class_memberships m
    where m.class_id = class_speaker_votes.class_id
      and m.user_id = auth.uid()
      and m.role = 'student'
      and coalesce(m.status, 'approved') = 'approved'
  )
);

drop policy if exists "students update own speaker votes" on public.class_speaker_votes;
create policy "students update own speaker votes" on public.class_speaker_votes
for update using (voter_user_id = auth.uid())
with check (voter_user_id = auth.uid());

drop policy if exists "students delete own speaker votes" on public.class_speaker_votes;
create policy "students delete own speaker votes" on public.class_speaker_votes
for delete using (voter_user_id = auth.uid());
