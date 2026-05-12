-- Committee assignment is a teacher action that can insert memberships for other
-- users. The color trigger must run with table-owner privileges so that the
-- derived editor-color row is created without tripping RLS on committee_member_colors.

create or replace function public.ensure_committee_member_color_on_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned text;
begin
  assigned := public.compute_committee_member_color(new.committee_id, new.user_id);
  insert into public.committee_member_colors (committee_id, user_id, color)
  values (new.committee_id, new.user_id, assigned)
  on conflict (committee_id, user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.ensure_committee_member_color_on_membership() from public;
grant execute on function public.ensure_committee_member_color_on_membership() to authenticated;
