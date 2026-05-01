create or replace function public.is_committee_leader(target_committee uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.committee_members m
    where m.committee_id = target_committee
      and m.user_id = target_user
      and m.role in ('chair', 'co_chair', 'ranking_member')
  )
$$;

revoke all on function public.is_committee_leader(uuid, uuid) from public;
grant execute on function public.is_committee_leader(uuid, uuid) to authenticated;

drop policy if exists "committee leaders manage roles" on public.committee_members;
create policy "committee leaders manage roles" on public.committee_members
for update using (public.is_committee_leader(committee_members.committee_id, auth.uid()))
with check (public.is_committee_leader(committee_members.committee_id, auth.uid()));

drop policy if exists "sender reads recipients" on public.dear_colleague_recipients;
create policy "sender reads recipients" on public.dear_colleague_recipients
for select using (
  exists (
    select 1
    from public.dear_colleague_letters l
    where l.id = dear_colleague_recipients.letter_id
      and l.sender_user_id = auth.uid()
  )
);

drop trigger if exists trg_notify_dear_colleague_recipient on public.dear_colleague_recipients;
