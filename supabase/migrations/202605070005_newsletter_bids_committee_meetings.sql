create table if not exists public.newsletter_ad_bids (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  bidder_user_id uuid not null references auth.users(id) on delete cascade,
  lobbyist_group_id uuid references public.lobbyist_groups(id) on delete set null,
  message text not null,
  amount integer not null default 0 check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists newsletter_ad_bids_class_created_idx on public.newsletter_ad_bids(class_id, created_at desc);
create index if not exists newsletter_ad_bids_bidder_idx on public.newsletter_ad_bids(bidder_user_id);

alter table public.newsletter_ad_bids enable row level security;

drop policy if exists "Class members can read newsletter ad bids" on public.newsletter_ad_bids;
create policy "Class members can read newsletter ad bids"
on public.newsletter_ad_bids for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.class_id = newsletter_ad_bids.class_id
  )
);

drop policy if exists "Class members can create newsletter ad bids" on public.newsletter_ad_bids;
create policy "Class members can create newsletter ad bids"
on public.newsletter_ad_bids for insert
with check (
  bidder_user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.class_id = newsletter_ad_bids.class_id
  )
);

drop policy if exists "Teachers can manage newsletter ad bids" on public.newsletter_ad_bids;
create policy "Teachers can manage newsletter ad bids"
on public.newsletter_ad_bids for update
using (
  exists (
    select 1 from public.classes c
    where c.id = newsletter_ad_bids.class_id
      and c.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.classes c
    where c.id = newsletter_ad_bids.class_id
      and c.teacher_id = auth.uid()
  )
);

create table if not exists public.committee_meetings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  started_by uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text
);

create index if not exists committee_meetings_committee_active_idx on public.committee_meetings(committee_id, ended_at, started_at desc);
create index if not exists committee_meetings_class_started_idx on public.committee_meetings(class_id, started_at desc);

alter table public.committee_meetings enable row level security;

drop policy if exists "Class members can read committee meetings" on public.committee_meetings;
create policy "Class members can read committee meetings"
on public.committee_meetings for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.class_id = committee_meetings.class_id
  )
);

drop policy if exists "Committee leaders and teachers can start meetings" on public.committee_meetings;
create policy "Committee leaders and teachers can start meetings"
on public.committee_meetings for insert
with check (
  started_by = auth.uid()
  and (
    exists (
      select 1 from public.classes c
      where c.id = committee_meetings.class_id
        and c.teacher_id = auth.uid()
    )
    or exists (
      select 1 from public.committee_members cm
      where cm.committee_id = committee_meetings.committee_id
        and cm.user_id = auth.uid()
        and cm.role in ('chair', 'co_chair', 'ranking_member')
    )
  )
);

drop policy if exists "Committee leaders and teachers can end meetings" on public.committee_meetings;
create policy "Committee leaders and teachers can end meetings"
on public.committee_meetings for update
using (
  exists (
    select 1 from public.classes c
    where c.id = committee_meetings.class_id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1 from public.committee_members cm
    where cm.committee_id = committee_meetings.committee_id
      and cm.user_id = auth.uid()
      and cm.role in ('chair', 'co_chair', 'ranking_member')
  )
)
with check (
  exists (
    select 1 from public.classes c
    where c.id = committee_meetings.class_id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1 from public.committee_members cm
    where cm.committee_id = committee_meetings.committee_id
      and cm.user_id = auth.uid()
      and cm.role in ('chair', 'co_chair', 'ranking_member')
  )
);
