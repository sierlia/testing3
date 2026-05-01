-- Persisted per-committee editor colors.
-- Colors are assigned the first time a user appears in a committee workspace
-- and remain stable even if they later leave/rejoin.

create table if not exists public.committee_member_colors (
  committee_id uuid not null references public.committees(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  color text not null,
  created_at timestamptz not null default now(),
  primary key (committee_id, user_id)
);

create index if not exists committee_member_colors_committee_idx on public.committee_member_colors(committee_id);

alter table public.committee_member_colors enable row level security;

do $$
begin
  drop policy if exists "class members read committee member colors" on public.committee_member_colors;
exception when undefined_object then null;
end $$;

create policy "class members read committee member colors" on public.committee_member_colors
for select using (
  exists (
    select 1
    from public.committees co
    where co.id = committee_member_colors.committee_id
      and co.class_id = public.my_class_id()
  )
  or exists (
    select 1
    from public.classes c
    join public.committees co on co.class_id = c.id
    where co.id = committee_member_colors.committee_id
      and c.teacher_id = auth.uid()
  )
);

do $$
begin
  drop policy if exists "users upsert own committee color" on public.committee_member_colors;
exception when undefined_object then null;
end $$;

create policy "users upsert own committee color" on public.committee_member_colors
for all using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.committees co
    where co.id = committee_member_colors.committee_id
      and co.class_id = public.my_class_id()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.committees co
    where co.id = committee_member_colors.committee_id
      and co.class_id = public.my_class_id()
  )
);

create or replace function public.compute_committee_member_color(target_committee uuid, target_user uuid)
returns text
language plpgsql
stable
as $$
declare
  palette text[] := array['#2563eb', '#7c3aed', '#16a34a', '#dc2626', '#0ea5e9', '#ea580c', '#db2777', '#059669'];
  h text;
  n bigint;
  idx integer;
begin
  h := md5(target_committee::text || ':' || target_user::text);
  n := ('x' || substr(h, 1, 16))::bit(64)::bigint;
  idx := (abs(n) % array_length(palette, 1)) + 1;
  return palette[idx];
end;
$$;

create or replace function public.ensure_committee_member_color(target_committee uuid)
returns text
language plpgsql
as $$
declare
  uid uuid := auth.uid();
  assigned text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure committee is in my current class (or I am its teacher)
  if not (
    exists (select 1 from public.committees co where co.id = target_committee and co.class_id = public.my_class_id())
    or exists (select 1 from public.classes c join public.committees co on co.class_id = c.id where co.id = target_committee and c.teacher_id = uid)
  ) then
    raise exception 'Not allowed';
  end if;

  select color into assigned
  from public.committee_member_colors
  where committee_id = target_committee and user_id = uid;

  if assigned is null then
    assigned := public.compute_committee_member_color(target_committee, uid);
    insert into public.committee_member_colors (committee_id, user_id, color)
    values (target_committee, uid, assigned)
    on conflict (committee_id, user_id) do nothing;
  end if;

  return assigned;
end;
$$;

revoke all on function public.ensure_committee_member_color(uuid) from public;
grant execute on function public.ensure_committee_member_color(uuid) to authenticated;

create or replace function public.ensure_committee_member_color_on_membership()
returns trigger
language plpgsql
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

drop trigger if exists trg_ensure_committee_member_color on public.committee_members;
create trigger trg_ensure_committee_member_color
after insert on public.committee_members
for each row execute function public.ensure_committee_member_color_on_membership();

