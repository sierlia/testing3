-- Server-side notifications with preference gating

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  org_type text not null check (org_type in ('caucus','committee','party','system')),
  org_id uuid,
  event_key text not null,
  title text not null,
  message text not null default '',
  href text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_recipient_created_idx on public.notifications(recipient_user_id, created_at desc);

alter table public.notifications enable row level security;

do $$
begin
  drop policy if exists "users read own notifications" on public.notifications;
exception when undefined_object then null;
end $$;
create policy "users read own notifications" on public.notifications
for select using (recipient_user_id = auth.uid());

do $$
begin
  drop policy if exists "users update own notifications" on public.notifications;
exception when undefined_object then null;
end $$;
create policy "users update own notifications" on public.notifications
for update using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

do $$
begin
  drop policy if exists "users delete own notifications" on public.notifications;
exception when undefined_object then null;
end $$;
create policy "users delete own notifications" on public.notifications
for delete using (recipient_user_id = auth.uid());

create or replace function public.notification_pref_enabled(target_user uuid, pref_key text, default_enabled boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (p.notification_prefs ->> pref_key)::boolean from public.profiles p where p.user_id = target_user),
    default_enabled
  )
$$;

create or replace function public.create_notification(
  target_class uuid,
  recipient uuid,
  actor uuid,
  org_type text,
  org_id uuid,
  event_key text,
  title text,
  message text,
  href text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if recipient is null then
    return;
  end if;
  insert into public.notifications(class_id, recipient_user_id, actor_user_id, org_type, org_id, event_key, title, message, href)
  values (target_class, recipient, actor, org_type, org_id, event_key, title, coalesce(message,''), coalesce(href,''));
end;
$$;

-- === Caucus triggers ===

create or replace function public.notify_on_caucus_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  member record;
begin
  select c.class_id into target_class from public.caucuses c where c.id = new.caucus_id;
  for member in select user_id from public.caucus_members where caucus_id = new.caucus_id and user_id <> new.author_user_id
  loop
    if public.notification_pref_enabled(member.user_id, 'caucus.new_announcement', true) then
      perform public.create_notification(
        target_class,
        member.user_id,
        new.author_user_id,
        'caucus',
        new.caucus_id,
        'caucus.new_announcement',
        'New caucus announcement',
        left(new.body, 180),
        '/caucuses/' || new.caucus_id::text
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_caucus_announcement on public.caucus_announcements;
create trigger trg_notify_caucus_announcement
after insert on public.caucus_announcements
for each row execute function public.notify_on_caucus_announcement();

create or replace function public.notify_on_caucus_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  caucus_id uuid;
  announcement_author uuid;
  parent_author uuid;
begin
  select a.caucus_id, c.class_id, a.author_user_id
  into caucus_id, target_class, announcement_author
  from public.caucus_announcements a
  join public.caucuses c on c.id = a.caucus_id
  where a.id = new.announcement_id;

  if announcement_author is not null and announcement_author <> new.author_user_id then
    if public.notification_pref_enabled(announcement_author, 'caucus.replies', true) then
      perform public.create_notification(
        target_class,
        announcement_author,
        new.author_user_id,
        'caucus',
        caucus_id,
        'caucus.replies',
        'New comment on your announcement',
        left(new.body, 180),
        '/caucuses/' || caucus_id::text
      );
    end if;
  end if;

  if new.parent_comment_id is not null then
    select author_user_id into parent_author from public.caucus_comments where id = new.parent_comment_id;
    if parent_author is not null and parent_author <> new.author_user_id then
      if public.notification_pref_enabled(parent_author, 'caucus.replies', true) then
        perform public.create_notification(
          target_class,
          parent_author,
          new.author_user_id,
          'caucus',
          caucus_id,
          'caucus.replies',
          'New reply to your comment',
          left(new.body, 180),
          '/caucuses/' || caucus_id::text
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_caucus_comment on public.caucus_comments;
create trigger trg_notify_caucus_comment
after insert on public.caucus_comments
for each row execute function public.notify_on_caucus_comment();

create or replace function public.notify_on_caucus_member_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  leader record;
begin
  select c.class_id into target_class
  from public.caucuses c where c.id = new.caucus_id;

  for leader in
    select user_id
    from public.caucus_members
    where caucus_id = new.caucus_id
      and role in ('chair','co_chair')
      and user_id <> new.user_id
  loop
    if public.notification_pref_enabled(leader.user_id, 'caucus.new_member_joined', false) then
      perform public.create_notification(
        target_class,
        leader.user_id,
        new.user_id,
        'caucus',
        new.caucus_id,
        'caucus.new_member_joined',
        'New caucus member joined',
        '',
        '/caucuses/' || new.caucus_id::text
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_caucus_member_join on public.caucus_members;
create trigger trg_notify_caucus_member_join
after insert on public.caucus_members
for each row execute function public.notify_on_caucus_member_join();

-- Caucus reactions
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
begin
  select a.caucus_id, c.class_id, a.author_user_id
  into caucus_id, target_class, recipient
  from public.caucus_announcements a
  join public.caucuses c on c.id = a.caucus_id
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
        'Reaction to your announcement',
        new.emoji,
        '/caucuses/' || caucus_id::text
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_caucus_announcement_reaction on public.caucus_announcement_reactions;
create trigger trg_notify_caucus_announcement_reaction
after insert on public.caucus_announcement_reactions
for each row execute function public.notify_on_caucus_announcement_reaction();

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
begin
  select a.caucus_id, c.class_id, cc.author_user_id
  into caucus_id, target_class, recipient
  from public.caucus_comments cc
  join public.caucus_announcements a on a.id = cc.announcement_id
  join public.caucuses c on c.id = a.caucus_id
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
        'Reaction to your comment',
        new.emoji,
        '/caucuses/' || caucus_id::text
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_caucus_comment_reaction on public.caucus_comment_reactions;
create trigger trg_notify_caucus_comment_reaction
after insert on public.caucus_comment_reactions
for each row execute function public.notify_on_caucus_comment_reaction();

-- === Committee triggers (announcements/comments/reactions) ===

create or replace function public.notify_on_committee_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  member record;
begin
  select c.class_id into target_class from public.committees c where c.id = new.committee_id;
  for member in select user_id from public.committee_members where committee_id = new.committee_id and user_id <> new.author_user_id
  loop
    if public.notification_pref_enabled(member.user_id, 'committee.new_announcement', true) then
      perform public.create_notification(
        target_class,
        member.user_id,
        new.author_user_id,
        'committee',
        new.committee_id,
        'committee.new_announcement',
        'New committee announcement',
        left(new.body, 180),
        '/committees/' || new.committee_id::text
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_committee_announcement on public.committee_announcements;
create trigger trg_notify_committee_announcement
after insert on public.committee_announcements
for each row execute function public.notify_on_committee_announcement();

create or replace function public.notify_on_committee_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  committee_id uuid;
  announcement_author uuid;
  parent_author uuid;
begin
  select a.committee_id, c.class_id, a.author_user_id
  into committee_id, target_class, announcement_author
  from public.committee_announcements a
  join public.committees c on c.id = a.committee_id
  where a.id = new.announcement_id;

  if announcement_author is not null and announcement_author <> new.author_user_id then
    if public.notification_pref_enabled(announcement_author, 'committee.replies', true) then
      perform public.create_notification(
        target_class,
        announcement_author,
        new.author_user_id,
        'committee',
        committee_id,
        'committee.replies',
        'New comment on your announcement',
        left(new.body, 180),
        '/committees/' || committee_id::text
      );
    end if;
  end if;

  if new.parent_comment_id is not null then
    select author_user_id into parent_author from public.committee_comments where id = new.parent_comment_id;
    if parent_author is not null and parent_author <> new.author_user_id then
      if public.notification_pref_enabled(parent_author, 'committee.replies', true) then
        perform public.create_notification(
          target_class,
          parent_author,
          new.author_user_id,
          'committee',
          committee_id,
          'committee.replies',
          'New reply to your comment',
          left(new.body, 180),
          '/committees/' || committee_id::text
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_committee_comment on public.committee_comments;
create trigger trg_notify_committee_comment
after insert on public.committee_comments
for each row execute function public.notify_on_committee_comment();

create or replace function public.notify_on_committee_announcement_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  recipient uuid;
begin
  select c.class_id, a.author_user_id into target_class, recipient
  from public.committee_announcements a
  join public.committees c on c.id = a.committee_id
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
        'Reaction to your announcement',
        new.emoji,
        '/committees/' || new.committee_id::text
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_committee_announcement_reaction on public.committee_announcement_reactions;
create trigger trg_notify_committee_announcement_reaction
after insert on public.committee_announcement_reactions
for each row execute function public.notify_on_committee_announcement_reaction();

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
begin
  select a.committee_id, c.class_id, cc.author_user_id
  into committee_id, target_class, recipient
  from public.committee_comments cc
  join public.committee_announcements a on a.id = cc.announcement_id
  join public.committees c on c.id = a.committee_id
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
        'Reaction to your comment',
        new.emoji,
        '/committees/' || committee_id::text
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_committee_comment_reaction on public.committee_comment_reactions;
create trigger trg_notify_committee_comment_reaction
after insert on public.committee_comment_reactions
for each row execute function public.notify_on_committee_comment_reaction();

