-- Committee report text attached to each committee bill workspace.

alter table public.committee_bill_docs
add column if not exists committee_report text not null default '';
