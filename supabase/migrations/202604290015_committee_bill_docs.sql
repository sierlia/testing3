-- Collaborative committee bill editing state (Yjs document persisted per bill+committee)

create table if not exists public.committee_bill_docs (
  bill_id uuid not null references public.bills(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  ydoc_base64 text not null default '',
  updated_at timestamptz not null default now(),
  primary key (bill_id, committee_id)
);

create index if not exists committee_bill_docs_committee_idx on public.committee_bill_docs(committee_id);

alter table public.committee_bill_docs enable row level security;

do $$
begin
  drop policy if exists "committee members read bill docs" on public.committee_bill_docs;
exception when undefined_object then null;
end $$;
create policy "committee members read bill docs" on public.committee_bill_docs
for select using (
  class_id = public.my_class_id()
  and exists (select 1 from public.committee_members m where m.committee_id = committee_id and m.user_id = auth.uid())
);

do $$
begin
  drop policy if exists "committee members write bill docs" on public.committee_bill_docs;
exception when undefined_object then null;
end $$;
create policy "committee members write bill docs" on public.committee_bill_docs
for all using (
  class_id = public.my_class_id()
  and exists (select 1 from public.committee_members m where m.committee_id = committee_id and m.user_id = auth.uid())
)
with check (
  class_id = public.my_class_id()
  and exists (select 1 from public.committee_members m where m.committee_id = committee_id and m.user_id = auth.uid())
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_committee_bill_docs on public.committee_bill_docs;
create trigger trg_touch_committee_bill_docs
before update on public.committee_bill_docs
for each row execute function public.touch_updated_at();

