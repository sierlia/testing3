-- Security hardening for authenticated-only access and stricter same-class writes.

-- The districts lookup is not sensitive, but keep it behind authentication so anon users
-- cannot query application tables directly.
drop policy if exists "class members read districts" on public.districts;
create policy "authenticated users read districts"
on public.districts
for select
to authenticated
using (auth.uid() is not null);

-- Help submissions should not be an anonymous write endpoint.
drop policy if exists "anyone can submit help messages" on public.help_messages;
create policy "authenticated users submit help messages"
on public.help_messages
for insert
to authenticated
with check (auth.uid() is not null);

-- Remove older permissive policies that were left active alongside stricter threaded
-- comment policies. Supabase ORs policies together, so the old policies still mattered.
drop policy if exists "class members comment" on public.caucus_comments;
drop policy if exists "class members comment on committee announcements" on public.committee_comments;

-- Same-class joins. The previous insert policies only checked user_id = auth.uid(),
-- which was too broad if an attacker guessed organization UUIDs.
drop policy if exists "users join caucus" on public.caucus_members;
create policy "users join same-class caucus"
on public.caucus_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.caucuses c
    where c.id = caucus_id
      and c.class_id = public.my_class_id()
  )
);

drop policy if exists "users join committee" on public.committee_members;
create policy "users join same-class committee"
on public.committee_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.committees c
    where c.id = committee_id
      and c.class_id = public.my_class_id()
  )
);
