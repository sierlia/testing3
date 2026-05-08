-- Let class teachers delete bills they manage. Related bill records use
-- foreign keys with ON DELETE CASCADE, so cosponsors, referrals, votes,
-- calendar entries, floor sessions, and teacher overrides are removed with it.

drop policy if exists "teachers delete class bills" on public.bills;

create policy "teachers delete class bills"
on public.bills
for delete
using (public.is_class_teacher(class_id));
