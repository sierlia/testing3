alter table public.lobbyist_groups
add column if not exists starting_amount integer not null default 0 check (starting_amount >= 0);
