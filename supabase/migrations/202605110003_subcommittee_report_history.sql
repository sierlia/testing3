alter table public.committee_bill_docs
  add column if not exists subcommittee_reports jsonb not null default '[]'::jsonb;
