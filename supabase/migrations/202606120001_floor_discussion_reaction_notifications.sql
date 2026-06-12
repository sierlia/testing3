-- Notify floor discussion authors when someone reacts to their post.

create or replace function public.notify_on_floor_discussion_reaction()
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
  reaction_label text;
begin
  select p.class_id, p.author_user_id, coalesce(actor.display_name, 'Someone'), area.title
  into target_class, recipient, actor_name, area_name
  from public.floor_discussion_posts p
  join public.floor_discussion_areas area on area.id = p.discussion_id
  left join public.profiles actor on actor.user_id = new.user_id
  where p.id = new.post_id;

  reaction_label := case new.emoji
    when 'thumbs_up' then 'thumbs up'
    when 'agree' then 'agree'
    when 'question' then 'question'
    else coalesce(new.emoji, 'reaction')
  end;

  if recipient is not null and recipient <> new.user_id then
    if public.notification_pref_enabled(recipient, 'floor.reactions', true) then
      perform public.create_notification(
        target_class,
        recipient,
        new.user_id,
        'system',
        null::uuid,
        'floor.reactions',
        actor_name || ' reacted ' || reaction_label || ' to your post in ' || coalesce(area_name, 'this discussion'),
        '',
        '/floor?mode=discussion'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_floor_discussion_reaction on public.floor_discussion_reactions;
create trigger trg_notify_floor_discussion_reaction
after insert on public.floor_discussion_reactions
for each row execute function public.notify_on_floor_discussion_reaction();
