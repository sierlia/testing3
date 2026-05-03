-- Collaborative committee bill docs must persist for users who are members of
-- the committee that owns the bill referral, even when class_memberships or the
-- active profile class is stale.

drop policy if exists "committee members read owned bill docs" on public.committee_bill_docs;
create policy "committee members read owned bill docs" on public.committee_bill_docs
for select using (
  exists (
    select 1
    from public.committee_members m
    join public.committees c on c.id = m.committee_id
    where m.committee_id = committee_bill_docs.committee_id
      and m.user_id = auth.uid()
      and c.class_id = committee_bill_docs.class_id
  )
);

drop policy if exists "committee members insert owned bill docs" on public.committee_bill_docs;
create policy "committee members insert owned bill docs" on public.committee_bill_docs
for insert with check (
  exists (
    select 1
    from public.committee_members m
    join public.committees c on c.id = m.committee_id
    where m.committee_id = committee_bill_docs.committee_id
      and m.user_id = auth.uid()
      and c.class_id = committee_bill_docs.class_id
  )
);

drop policy if exists "committee members update owned bill docs" on public.committee_bill_docs;
create policy "committee members update owned bill docs" on public.committee_bill_docs
for update using (
  exists (
    select 1
    from public.committee_members m
    join public.committees c on c.id = m.committee_id
    where m.committee_id = committee_bill_docs.committee_id
      and m.user_id = auth.uid()
      and c.class_id = committee_bill_docs.class_id
  )
)
with check (
  exists (
    select 1
    from public.committee_members m
    join public.committees c on c.id = m.committee_id
    where m.committee_id = committee_bill_docs.committee_id
      and m.user_id = auth.uid()
      and c.class_id = committee_bill_docs.class_id
  )
);

