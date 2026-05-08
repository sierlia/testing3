-- Delete bills through a teacher-only RPC so the client does not depend on
-- RLS-visible deleted rows. The function still checks class teacher status
-- before deleting, then cascades through bill foreign keys.

create or replace function public.delete_bill_for_teacher(target_bill uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  deleted_bill uuid;
begin
  select b.class_id
  into target_class
  from public.bills b
  where b.id = target_bill;

  if target_class is null then
    raise exception 'Bill not found';
  end if;

  if not public.is_class_teacher(target_class) then
    raise exception 'Only teachers can delete bills';
  end if;

  delete from public.bills b
  where b.id = target_bill
  returning b.id into deleted_bill;

  if deleted_bill is null then
    raise exception 'Bill could not be deleted';
  end if;

  return deleted_bill;
end;
$$;

revoke all on function public.delete_bill_for_teacher(uuid) from public;
grant execute on function public.delete_bill_for_teacher(uuid) to authenticated;
