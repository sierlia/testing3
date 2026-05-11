-- Keep teacher referral overrides and committee vote participation working after
-- multi-referral/subcommittee support.

create or replace function public.teacher_set_bill_referral(target_bill uuid, target_committee uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
begin
  select b.class_id into target_class
  from public.bills b
  where b.id = target_bill;

  if target_class is null then
    raise exception 'Bill not found';
  end if;

  if not public.is_class_teacher(target_class) then
    raise exception 'Only class teachers can refer this bill';
  end if;

  if not exists (
    select 1
    from public.committees c
    where c.id = target_committee
      and c.class_id = target_class
  ) then
    raise exception 'Committee not found for this class';
  end if;

  delete from public.bill_referrals
  where bill_id = target_bill
    and class_id = target_class;

  insert into public.bill_referrals (bill_id, class_id, committee_id, referred_by, referred_at)
  values (target_bill, target_class, target_committee, auth.uid(), now());

  update public.bills
  set status = 'in_committee'
  where id = target_bill
    and class_id = target_class;

  return target_committee;
end;
$$;

grant execute on function public.teacher_set_bill_referral(uuid, uuid) to authenticated;

drop policy if exists "teachers read committee votes" on public.bill_committee_votes;
create policy "teachers read committee votes" on public.bill_committee_votes
for select using (public.is_class_teacher(class_id));

drop policy if exists "teachers cast committee votes" on public.bill_committee_votes;
create policy "teachers cast committee votes" on public.bill_committee_votes
for insert with check (
  user_id = auth.uid()
  and public.is_class_teacher(class_id)
  and exists (
    select 1
    from public.bills b
    where b.id = bill_committee_votes.bill_id
      and b.class_id = bill_committee_votes.class_id
      and b.status = 'committee_vote'
  )
);

drop policy if exists "teachers update own committee votes" on public.bill_committee_votes;
create policy "teachers update own committee votes" on public.bill_committee_votes
for update using (
  user_id = auth.uid()
  and public.is_class_teacher(class_id)
  and exists (
    select 1
    from public.bills b
    where b.id = bill_committee_votes.bill_id
      and b.class_id = bill_committee_votes.class_id
      and b.status = 'committee_vote'
  )
)
with check (
  user_id = auth.uid()
  and public.is_class_teacher(class_id)
  and exists (
    select 1
    from public.bills b
    where b.id = bill_committee_votes.bill_id
      and b.class_id = bill_committee_votes.class_id
      and b.status = 'committee_vote'
  )
);

drop policy if exists "teachers delete own committee votes" on public.bill_committee_votes;
create policy "teachers delete own committee votes" on public.bill_committee_votes
for delete using (
  user_id = auth.uid()
  and public.is_class_teacher(class_id)
);
