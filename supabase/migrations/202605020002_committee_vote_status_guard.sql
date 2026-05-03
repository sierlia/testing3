-- Committee ballots may only be cast while the referred bill is open for committee vote.

drop policy if exists "committee members cast committee votes" on public.bill_committee_votes;
create policy "committee members cast committee votes" on public.bill_committee_votes
for insert with check (
  user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (select 1 from public.committee_members m where m.committee_id = bill_committee_votes.committee_id and m.user_id = auth.uid())
  and exists (select 1 from public.bills b where b.id = bill_committee_votes.bill_id and b.class_id = bill_committee_votes.class_id and b.status = 'committee_vote')
);

drop policy if exists "committee members update own committee votes" on public.bill_committee_votes;
create policy "committee members update own committee votes" on public.bill_committee_votes
for update using (
  user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (select 1 from public.bills b where b.id = bill_committee_votes.bill_id and b.class_id = bill_committee_votes.class_id and b.status = 'committee_vote')
)
with check (
  user_id = auth.uid()
  and class_id = public.my_class_id()
  and exists (select 1 from public.bills b where b.id = bill_committee_votes.bill_id and b.class_id = bill_committee_votes.class_id and b.status = 'committee_vote')
);
