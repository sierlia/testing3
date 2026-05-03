-- Add class-level party colors for organization lists and dashboards.

alter table public.parties
add column if not exists color text not null default '#2563eb';

update public.parties
set color = case
  when lower(name) like '%democrat%' then '#2563eb'
  when lower(name) like '%republican%' then '#dc2626'
  when lower(name) like '%green%' then '#16a34a'
  when lower(name) like '%libertarian%' then '#ca8a04'
  else color
end
where color is null or color = '#2563eb';
