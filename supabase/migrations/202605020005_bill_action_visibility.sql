-- Bill detail action history needs committee vote tallies for class members.

drop policy if exists "class members read committee votes for bill actions" on public.bill_committee_votes;
create policy "class members read committee votes for bill actions" on public.bill_committee_votes
for select using (class_id = public.my_class_id());

