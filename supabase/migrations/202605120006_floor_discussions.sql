create table if not exists public.floor_discussion_areas (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  prompt text not null default '',
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.floor_discussion_posts (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.floor_discussion_areas(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.floor_discussion_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.floor_discussion_posts(id) on delete cascade,
  discussion_id uuid not null references public.floor_discussion_areas(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.floor_discussion_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.floor_discussion_posts(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('thumbs_up', 'agree', 'question')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create unique index if not exists floor_discussion_areas_one_active_idx
on public.floor_discussion_areas(class_id)
where is_active;

create index if not exists floor_discussion_areas_class_idx on public.floor_discussion_areas(class_id, created_at desc);
create index if not exists floor_discussion_posts_discussion_idx on public.floor_discussion_posts(discussion_id, created_at desc);
create index if not exists floor_discussion_comments_post_idx on public.floor_discussion_comments(post_id, created_at asc);
create index if not exists floor_discussion_reactions_post_idx on public.floor_discussion_reactions(post_id);
create index if not exists floor_discussion_posts_author_idx on public.floor_discussion_posts(class_id, author_user_id);
create index if not exists floor_discussion_comments_author_idx on public.floor_discussion_comments(class_id, author_user_id);

alter table public.floor_discussion_areas enable row level security;
alter table public.floor_discussion_posts enable row level security;
alter table public.floor_discussion_comments enable row level security;
alter table public.floor_discussion_reactions enable row level security;

drop policy if exists "class members read floor discussion areas" on public.floor_discussion_areas;
create policy "class members read floor discussion areas"
on public.floor_discussion_areas for select
using (public.can_read_class(class_id));

drop policy if exists "teachers manage floor discussion areas" on public.floor_discussion_areas;
create policy "teachers manage floor discussion areas"
on public.floor_discussion_areas for all
using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));

drop policy if exists "class members read floor discussion posts" on public.floor_discussion_posts;
create policy "class members read floor discussion posts"
on public.floor_discussion_posts for select
using (public.can_read_class(class_id));

drop policy if exists "class members create floor discussion posts" on public.floor_discussion_posts;
create policy "class members create floor discussion posts"
on public.floor_discussion_posts for insert
with check (author_user_id = auth.uid() and public.can_read_class(class_id));

drop policy if exists "authors and teachers update floor discussion posts" on public.floor_discussion_posts;
create policy "authors and teachers update floor discussion posts"
on public.floor_discussion_posts for update
using (author_user_id = auth.uid() or public.is_class_teacher(class_id))
with check (author_user_id = auth.uid() or public.is_class_teacher(class_id));

drop policy if exists "authors and teachers delete floor discussion posts" on public.floor_discussion_posts;
create policy "authors and teachers delete floor discussion posts"
on public.floor_discussion_posts for delete
using (author_user_id = auth.uid() or public.is_class_teacher(class_id));

drop policy if exists "class members read floor discussion comments" on public.floor_discussion_comments;
create policy "class members read floor discussion comments"
on public.floor_discussion_comments for select
using (public.can_read_class(class_id));

drop policy if exists "class members create floor discussion comments" on public.floor_discussion_comments;
create policy "class members create floor discussion comments"
on public.floor_discussion_comments for insert
with check (author_user_id = auth.uid() and public.can_read_class(class_id));

drop policy if exists "authors and teachers update floor discussion comments" on public.floor_discussion_comments;
create policy "authors and teachers update floor discussion comments"
on public.floor_discussion_comments for update
using (author_user_id = auth.uid() or public.is_class_teacher(class_id))
with check (author_user_id = auth.uid() or public.is_class_teacher(class_id));

drop policy if exists "authors and teachers delete floor discussion comments" on public.floor_discussion_comments;
create policy "authors and teachers delete floor discussion comments"
on public.floor_discussion_comments for delete
using (author_user_id = auth.uid() or public.is_class_teacher(class_id));

drop policy if exists "class members read floor discussion reactions" on public.floor_discussion_reactions;
create policy "class members read floor discussion reactions"
on public.floor_discussion_reactions for select
using (public.can_read_class(class_id));

drop policy if exists "class members create floor discussion reactions" on public.floor_discussion_reactions;
create policy "class members create floor discussion reactions"
on public.floor_discussion_reactions for insert
with check (user_id = auth.uid() and public.can_read_class(class_id));

drop policy if exists "users delete own floor discussion reactions" on public.floor_discussion_reactions;
create policy "users delete own floor discussion reactions"
on public.floor_discussion_reactions for delete
using (user_id = auth.uid() or public.is_class_teacher(class_id));
