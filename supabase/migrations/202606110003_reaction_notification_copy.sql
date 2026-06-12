-- Make reaction notifications read as complete activity sentences.

create or replace function public.notify_on_caucus_announcement_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  caucus_id uuid;
  recipient uuid;
  actor_name text;
  area_name text;
begin
  select a.caucus_id, c.class_id, a.author_user_id, coalesce(p.display_name, 'Someone'), c.title
  into caucus_id, target_class, recipient, actor_name, area_name
  from public.caucus_announcements a
  join public.caucuses c on c.id = a.caucus_id
  left join public.profiles p on p.user_id = new.user_id
  where a.id = new.announcement_id;

  if recipient is not null and recipient <> new.user_id then
    if public.notification_pref_enabled(recipient, 'caucus.reactions', true) then
      perform public.create_notification(
        target_class,
        recipient,
        new.user_id,
        'caucus',
        caucus_id,
        'caucus.reactions',
        actor_name || ' reacted ' || coalesce(new.emoji, '') || ' to your announcement in ' || coalesce(area_name, 'this caucus'),
        '',
        '/caucuses/' || caucus_id::text
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_on_caucus_comment_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  caucus_id uuid;
  recipient uuid;
  actor_name text;
  area_name text;
begin
  select a.caucus_id, c.class_id, cc.author_user_id, coalesce(p.display_name, 'Someone'), c.title
  into caucus_id, target_class, recipient, actor_name, area_name
  from public.caucus_comments cc
  join public.caucus_announcements a on a.id = cc.announcement_id
  join public.caucuses c on c.id = a.caucus_id
  left join public.profiles p on p.user_id = new.user_id
  where cc.id = new.comment_id;

  if recipient is not null and recipient <> new.user_id then
    if public.notification_pref_enabled(recipient, 'caucus.reactions', true) then
      perform public.create_notification(
        target_class,
        recipient,
        new.user_id,
        'caucus',
        caucus_id,
        'caucus.reactions',
        actor_name || ' reacted ' || coalesce(new.emoji, '') || ' to your comment in ' || coalesce(area_name, 'this caucus'),
        '',
        '/caucuses/' || caucus_id::text
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_on_committee_announcement_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  recipient uuid;
  actor_name text;
  area_name text;
begin
  select c.class_id, a.author_user_id, coalesce(p.display_name, 'Someone'), c.name
  into target_class, recipient, actor_name, area_name
  from public.committee_announcements a
  join public.committees c on c.id = a.committee_id
  left join public.profiles p on p.user_id = new.user_id
  where a.id = new.announcement_id;

  if recipient is not null and recipient <> new.user_id then
    if public.notification_pref_enabled(recipient, 'committee.reactions', true) then
      perform public.create_notification(
        target_class,
        recipient,
        new.user_id,
        'committee',
        new.committee_id,
        'committee.reactions',
        actor_name || ' reacted ' || coalesce(new.emoji, '') || ' to your announcement in ' || coalesce(area_name, 'this committee'),
        '',
        '/committees/' || new.committee_id::text
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_on_committee_comment_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  committee_id uuid;
  recipient uuid;
  actor_name text;
  area_name text;
begin
  select a.committee_id, c.class_id, cc.author_user_id, coalesce(p.display_name, 'Someone'), c.name
  into committee_id, target_class, recipient, actor_name, area_name
  from public.committee_comments cc
  join public.committee_announcements a on a.id = cc.announcement_id
  join public.committees c on c.id = a.committee_id
  left join public.profiles p on p.user_id = new.user_id
  where cc.id = new.comment_id;

  if recipient is not null and recipient <> new.user_id then
    if public.notification_pref_enabled(recipient, 'committee.reactions', true) then
      perform public.create_notification(
        target_class,
        recipient,
        new.user_id,
        'committee',
        committee_id,
        'committee.reactions',
        actor_name || ' reacted ' || coalesce(new.emoji, '') || ' to your comment in ' || coalesce(area_name, 'this committee'),
        '',
        '/committees/' || committee_id::text
      );
    end if;
  end if;
  return new;
end;
$$;
