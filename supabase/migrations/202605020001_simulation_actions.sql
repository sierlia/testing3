-- Committee votes, floor calendar, floor votes, party boards, and leadership elections.

create table if not exists public.bill_committee_votes (
  bill_id uuid not null references public.bills(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('yea','nay','present')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bill_id, committee_id, user_id)
);

create table if not exists public.bill_calendar (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30,
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, bill_id)
);

create table if not exists public.bill_floor_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  calendar_id uuid references public.bill_calendar(id) on delete set null,
  status text not null default 'closed' check (status in ('open','closed')),
  opened_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (class_id, bill_id)
);

create table if not exists public.bill_floor_votes (
  session_id uuid not null references public.bill_floor_sessions(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('yea','nay','present')),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.party_announcements (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.party_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.party_announcements(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.party_leadership_votes (
  party_id uuid not null references public.parties(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  candidate_user_id uuid not null references auth.users(id) on delete cascade,
  position text not null check (position in ('chair','whip')),
  created_at timestamptz not null default now(),
  primary key (party_id, voter_user_id, position)
);

create table if not exists public.committee_leadership_votes (
  committee_id uuid not null references public.committees(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  candidate_user_id uuid not null references auth.users(id) on delete cascade,
  position text not null check (position in ('chair','ranking_member')),
  created_at timestamptz not null default now(),
  primary key (committee_id, voter_user_id, position)
);

alter table public.bill_committee_votes enable row level security;
alter table public.bill_calendar enable row level security;
alter table public.bill_floor_sessions enable row level security;
alter table public.bill_floor_votes enable row level security;
alter table public.party_announcements enable row level security;
alter table public.party_comments enable row level security;
alter table public.party_leadership_votes enable row level security;
alter table public.committee_leadership_votes enable row level security;

drop policy if exists "committee members read committee votes" on public.bill_committee_votes;
create policy "committee members read committee votes" on public.bill_committee_votes
for select using (
  class_id = public.my_class_id()
  and exists (select 1 from public.committee_members m where m.committee_id = bill_committee_votes.committee_id and m.user_id = auth.uid())
);

drop policy if exists "committee members cast committee votes" on public.bill_committee_votes;
create policy "committee members cast committee votes" on public.bill_committee_votes
for insert with check (
  user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (select 1 from public.committee_members m where m.committee_id = bill_committee_votes.committee_id and m.user_id = auth.uid())
);

drop policy if exists "committee members update own committee votes" on public.bill_committee_votes;
create policy "committee members update own committee votes" on public.bill_committee_votes
for update using (user_id = auth.uid() and class_id = public.my_class_id())
with check (user_id = auth.uid() and class_id = public.my_class_id());

drop policy if exists "class members read bill calendar" on public.bill_calendar;
create policy "class members read bill calendar" on public.bill_calendar
for select using (class_id = public.my_class_id() and published = true);

drop policy if exists "teachers manage bill calendar" on public.bill_calendar;
create policy "teachers manage bill calendar" on public.bill_calendar
for all using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()))
with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));

drop policy if exists "class members read floor sessions" on public.bill_floor_sessions;
create policy "class members read floor sessions" on public.bill_floor_sessions
for select using (class_id = public.my_class_id());

drop policy if exists "teachers manage floor sessions" on public.bill_floor_sessions;
create policy "teachers manage floor sessions" on public.bill_floor_sessions
for all using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()))
with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));

drop policy if exists "class members read floor votes" on public.bill_floor_votes;
create policy "class members read floor votes" on public.bill_floor_votes
for select using (class_id = public.my_class_id());

drop policy if exists "students cast floor votes" on public.bill_floor_votes;
create policy "students cast floor votes" on public.bill_floor_votes
for insert with check (
  user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (select 1 from public.bill_floor_sessions s where s.id = session_id and s.status = 'open')
);

drop policy if exists "class members read party announcements" on public.party_announcements;
create policy "class members read party announcements" on public.party_announcements
for select using (class_id = public.my_class_id());

drop policy if exists "party members post announcements" on public.party_announcements;
create policy "party members post announcements" on public.party_announcements
for insert with check (
  author_user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (
    select 1 from public.parties pa
    join public.profiles p on p.user_id = auth.uid()
    where pa.id = party_id and pa.name = p.party and pa.class_id = class_id
  )
);

drop policy if exists "class members read party comments" on public.party_comments;
create policy "class members read party comments" on public.party_comments
for select using (
  exists (
    select 1 from public.party_announcements a
    where a.id = announcement_id and a.class_id = public.my_class_id()
  )
);

drop policy if exists "party members comment" on public.party_comments;
create policy "party members comment" on public.party_comments
for insert with check (
  author_user_id = auth.uid()
  and exists (
    select 1 from public.party_announcements a
    join public.parties pa on pa.id = a.party_id
    join public.profiles p on p.user_id = auth.uid()
    where a.id = announcement_id and a.class_id = public.my_class_id() and p.party = pa.name
  )
);

drop policy if exists "party members read leadership votes" on public.party_leadership_votes;
create policy "party members read leadership votes" on public.party_leadership_votes
for select using (class_id = public.my_class_id());

drop policy if exists "party members cast leadership votes" on public.party_leadership_votes;
create policy "party members cast leadership votes" on public.party_leadership_votes
for insert with check (
  voter_user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (
    select 1 from public.parties pa
    join public.profiles voter on voter.user_id = auth.uid()
    join public.profiles candidate on candidate.user_id = candidate_user_id
    where pa.id = party_id and pa.class_id = class_id and voter.party = pa.name and candidate.party = pa.name
  )
);

drop policy if exists "party members update own leadership votes" on public.party_leadership_votes;
create policy "party members update own leadership votes" on public.party_leadership_votes
for update using (voter_user_id = auth.uid() and class_id = public.my_class_id())
with check (
  voter_user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (
    select 1 from public.parties pa
    join public.profiles voter on voter.user_id = auth.uid()
    join public.profiles candidate on candidate.user_id = candidate_user_id
    where pa.id = party_id and pa.class_id = class_id and voter.party = pa.name and candidate.party = pa.name
  )
);

drop policy if exists "committee members read leadership votes" on public.committee_leadership_votes;
create policy "committee members read leadership votes" on public.committee_leadership_votes
for select using (
  class_id = public.my_class_id()
  and exists (select 1 from public.committee_members m where m.committee_id = committee_leadership_votes.committee_id and m.user_id = auth.uid())
);

drop policy if exists "teachers read committee leadership votes" on public.committee_leadership_votes;
create policy "teachers read committee leadership votes" on public.committee_leadership_votes
for select using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));

drop policy if exists "committee members cast leadership votes" on public.committee_leadership_votes;
create policy "committee members cast leadership votes" on public.committee_leadership_votes
for insert with check (
  voter_user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (select 1 from public.committee_members m where m.committee_id = committee_leadership_votes.committee_id and m.user_id = auth.uid())
  and exists (select 1 from public.committee_members m where m.committee_id = committee_leadership_votes.committee_id and m.user_id = candidate_user_id)
);

drop policy if exists "committee members update own leadership votes" on public.committee_leadership_votes;
create policy "committee members update own leadership votes" on public.committee_leadership_votes
for update using (voter_user_id = auth.uid() and class_id = public.my_class_id())
with check (
  voter_user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (select 1 from public.committee_members m where m.committee_id = committee_leadership_votes.committee_id and m.user_id = auth.uid())
  and exists (select 1 from public.committee_members m where m.committee_id = committee_leadership_votes.committee_id and m.user_id = candidate_user_id)
);

drop policy if exists "teachers update class bills" on public.bills;
create policy "teachers update class bills" on public.bills
for update using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()))
with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));

drop policy if exists "committee leaders update referred bills" on public.bills;
create policy "committee leaders update referred bills" on public.bills
for update using (
  exists (
    select 1
    from public.bill_referrals r
    join public.committee_members m on m.committee_id = r.committee_id
    where r.bill_id = bills.id
      and r.class_id = bills.class_id
      and m.user_id = auth.uid()
      and m.role in ('chair','co_chair','ranking_member')
  )
)
with check (class_id = public.my_class_id());
