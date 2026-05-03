-- Explicit progress marker for committee bill markup.

alter table public.committee_bill_docs
add column if not exists committee_markup_posted_at timestamptz;

