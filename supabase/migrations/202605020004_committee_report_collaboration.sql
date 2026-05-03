-- Collaborative committee reports and member proposal/finalization flow.

alter table public.committee_bill_docs
add column if not exists committee_report_ydoc_base64 text not null default '',
add column if not exists committee_report_submitted_at timestamptz;

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
with check (class_id = public.my_class_id() and status in ('committee_vote','calendared','failed'));
