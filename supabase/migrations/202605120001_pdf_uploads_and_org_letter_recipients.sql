-- Persist PDF upload modes and organization-addressed Dear Colleague letters.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('simulation-pdfs', 'simulation-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.committee_bill_docs
  add column if not exists revised_pdf_path text,
  add column if not exists committee_report_pdf_path text;

alter table public.profiles
  add column if not exists profile_pdf_path text;

create table if not exists public.dear_colleague_org_recipients (
  letter_id uuid not null references public.dear_colleague_letters(id) on delete cascade,
  organization_type text not null check (organization_type in ('party', 'committee', 'caucus')),
  organization_id uuid not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (letter_id, organization_type, organization_id)
);

create index if not exists dear_colleague_org_recipients_org_idx
  on public.dear_colleague_org_recipients(organization_type, organization_id, created_at desc);

alter table public.dear_colleague_org_recipients enable row level security;

drop policy if exists "class members read organization letter recipients" on public.dear_colleague_org_recipients;
create policy "class members read organization letter recipients" on public.dear_colleague_org_recipients
for select using (class_id = public.my_class_id());

drop policy if exists "senders insert organization letter recipients" on public.dear_colleague_org_recipients;
create policy "senders insert organization letter recipients" on public.dear_colleague_org_recipients
for insert with check (
  class_id = public.my_class_id()
  and exists (
    select 1
    from public.dear_colleague_letters l
    where l.id = dear_colleague_org_recipients.letter_id
      and l.sender_user_id = auth.uid()
      and l.class_id = dear_colleague_org_recipients.class_id
  )
);
