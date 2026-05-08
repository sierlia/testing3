-- Low-risk indexes for common class-scoped reads, membership checks, dashboards,
-- records, bill lists, and vote summaries. These reduce CPU spent on repeated
-- scans under RLS-heavy queries.

create index if not exists classes_teacher_created_idx
on public.classes(teacher_id, created_at desc);

create index if not exists profiles_class_role_user_idx
on public.profiles(class_id, role, user_id);

create index if not exists profiles_class_party_idx
on public.profiles(class_id, party);

create index if not exists class_memberships_user_status_role_idx
on public.class_memberships(user_id, status, role, class_id);

create index if not exists class_memberships_class_role_status_idx
on public.class_memberships(class_id, role, status, user_id);

create index if not exists committees_class_name_idx
on public.committees(class_id, name);

create index if not exists caucuses_class_title_idx
on public.caucuses(class_id, title);

create index if not exists parties_class_approved_name_idx
on public.parties(class_id, approved, name);

create index if not exists committee_members_user_committee_idx
on public.committee_members(user_id, committee_id);

create index if not exists committee_members_committee_role_idx
on public.committee_members(committee_id, role, user_id);

create index if not exists caucus_members_user_caucus_idx
on public.caucus_members(user_id, caucus_id);

create index if not exists caucus_members_caucus_role_idx
on public.caucus_members(caucus_id, role, user_id);

create index if not exists bills_class_status_number_idx
on public.bills(class_id, status, bill_number);

create index if not exists bills_class_author_created_idx
on public.bills(class_id, author_user_id, created_at desc);

create index if not exists bills_class_created_idx
on public.bills(class_id, created_at desc);

create index if not exists bill_cosponsors_user_bill_idx
on public.bill_cosponsors(user_id, bill_id);

create index if not exists bill_referrals_bill_class_idx
on public.bill_referrals(bill_id, class_id);

create index if not exists bill_referrals_class_bill_committee_idx
on public.bill_referrals(class_id, bill_id, committee_id);

create index if not exists committee_bill_docs_class_report_idx
on public.committee_bill_docs(class_id, committee_report_submitted_at desc)
where committee_report_submitted_at is not null;

create index if not exists committee_bill_docs_class_vote_finalized_idx
on public.committee_bill_docs(class_id, committee_vote_finalized_at desc)
where committee_vote_finalized_at is not null;

create index if not exists committee_bill_docs_bill_committee_idx
on public.committee_bill_docs(bill_id, committee_id);

create index if not exists bill_committee_votes_class_bill_committee_idx
on public.bill_committee_votes(class_id, bill_id, committee_id);

create index if not exists bill_committee_votes_user_created_idx
on public.bill_committee_votes(user_id, created_at desc);

create index if not exists bill_calendar_class_published_scheduled_idx
on public.bill_calendar(class_id, published, scheduled_at);

create index if not exists bill_floor_sessions_class_results_idx
on public.bill_floor_sessions(class_id, results_posted_at desc)
where results_posted_at is not null;

create index if not exists bill_floor_votes_class_session_idx
on public.bill_floor_votes(class_id, session_id);

create index if not exists bill_floor_votes_user_created_idx
on public.bill_floor_votes(user_id, created_at desc);

-- Older databases may have bill_floor_speakers from the first signup migration,
-- where the later status/role columns were skipped by create table if not exists.
alter table public.bill_floor_speakers
  add column if not exists status text not null default 'approved',
  add column if not exists speaker_role text not null default 'speaker',
  add column if not exists updated_at timestamptz not null default now();

create index if not exists bill_floor_speakers_class_bill_status_idx
on public.bill_floor_speakers(class_id, bill_id, status);

create index if not exists class_tasks_class_due_idx
on public.class_tasks(class_id, due_at)
where due_at is not null;

create index if not exists dear_colleague_letters_class_created_idx
on public.dear_colleague_letters(class_id, created_at desc);

create index if not exists dear_colleague_letters_sender_created_idx
on public.dear_colleague_letters(sender_user_id, created_at desc);

create index if not exists dear_colleague_recipients_user_read_idx
on public.dear_colleague_recipients(recipient_user_id, read_at);

create index if not exists custom_records_class_type_created_idx
on public.custom_records(class_id, type, created_at desc);

create index if not exists lobbyist_groups_class_name_idx
on public.lobbyist_groups(class_id, name);

create index if not exists lobbyist_group_members_user_group_idx
on public.lobbyist_group_members(user_id, group_id);

create index if not exists lobbyist_contributions_class_created_idx
on public.lobbyist_contributions(class_id, created_at desc);

create index if not exists lobbyist_contributions_recipient_idx
on public.lobbyist_contributions(class_id, recipient_type, recipient_id, created_at desc);

create index if not exists lobbyist_contributions_from_user_idx
on public.lobbyist_contributions(from_user_id, created_at desc);
