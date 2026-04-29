-- Postgres requires the enum value to be committed before it can be safely referenced.
-- This migration updates committee announcement policy to include 'ranking_member'
-- after 202604290007 has added the enum value.

drop policy if exists "committee leaders post announcements" on public.committee_announcements;

create policy "committee leaders post announcements" on public.committee_announcements
for insert with check (
  exists (
    select 1
    from public.committee_members m
    where m.committee_id = committee_id
      and m.user_id = auth.uid()
      and m.role in ('chair', 'co_chair', 'ranking_member')
  )
);

