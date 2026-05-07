-- Let all class teachers manage bill referrals, not only the class owner.

drop policy if exists "teachers manage bill referrals" on public.bill_referrals;

create policy "teachers manage bill referrals" on public.bill_referrals
for all using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));

drop policy if exists "committee leaders update referral subcommittees" on public.bill_referrals;

create policy "committee leaders update referral subcommittees" on public.bill_referrals
for update using (
  public.is_committee_leader(committee_id, auth.uid())
  or public.is_class_teacher(class_id)
)
with check (
  public.is_committee_leader(committee_id, auth.uid())
  or public.is_class_teacher(class_id)
);
