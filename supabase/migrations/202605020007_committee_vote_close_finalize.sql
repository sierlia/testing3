-- Separate committee vote closure from final bill disposition.

alter table public.committee_bill_docs
add column if not exists committee_vote_closed_at timestamptz,
add column if not exists committee_vote_finalized_at timestamptz;

drop policy if exists "committee members propose referred bills" on public.bills;
create policy "committee members propose referred bills" on public.bills
for update using (
  exists (
    select 1
    from public.bill_referrals r
    join public.committee_members m on m.committee_id = r.committee_id
    where r.bill_id = bills.id
      and r.class_id = bills.class_id
      and m.user_id = auth.uid()
  )
)
with check (class_id = public.my_class_id() and status in ('committee_vote','reported','failed'));

drop policy if exists "committee members cast committee votes" on public.bill_committee_votes;
create policy "committee members cast committee votes" on public.bill_committee_votes
for insert with check (
  user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (select 1 from public.committee_members m where m.committee_id = bill_committee_votes.committee_id and m.user_id = auth.uid())
  and exists (select 1 from public.bills b where b.id = bill_committee_votes.bill_id and b.class_id = bill_committee_votes.class_id and b.status = 'committee_vote')
  and not exists (
    select 1
    from public.committee_bill_docs d
    where d.bill_id = bill_committee_votes.bill_id
      and d.committee_id = bill_committee_votes.committee_id
      and d.committee_vote_closed_at is not null
  )
);

drop policy if exists "committee members update own committee votes" on public.bill_committee_votes;
create policy "committee members update own committee votes" on public.bill_committee_votes
for update using (
  user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (select 1 from public.bills b where b.id = bill_committee_votes.bill_id and b.class_id = bill_committee_votes.class_id and b.status = 'committee_vote')
  and not exists (
    select 1
    from public.committee_bill_docs d
    where d.bill_id = bill_committee_votes.bill_id
      and d.committee_id = bill_committee_votes.committee_id
      and d.committee_vote_closed_at is not null
  )
)
with check (
  user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (select 1 from public.bills b where b.id = bill_committee_votes.bill_id and b.class_id = bill_committee_votes.class_id and b.status = 'committee_vote')
  and not exists (
    select 1
    from public.committee_bill_docs d
    where d.bill_id = bill_committee_votes.bill_id
      and d.committee_id = bill_committee_votes.committee_id
      and d.committee_vote_closed_at is not null
  )
);

