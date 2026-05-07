create table if not exists public.bill_floor_speakers (
  bill_id uuid not null references public.bills(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  side text not null check (side in ('for', 'against')),
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  speaker_role text not null default 'speaker' check (speaker_role in ('speaker', 'opposition_leader')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bill_id, user_id)
);

create table if not exists public.bill_previous_question_votes (
  bill_id uuid not null references public.bills(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('yea', 'nay')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bill_id, user_id)
);

create index if not exists bill_floor_speakers_class_bill_idx on public.bill_floor_speakers(class_id, bill_id);
create index if not exists bill_previous_question_votes_class_bill_idx on public.bill_previous_question_votes(class_id, bill_id);

alter table public.bill_floor_speakers enable row level security;
alter table public.bill_previous_question_votes enable row level security;

drop policy if exists "class members read floor speakers" on public.bill_floor_speakers;
create policy "class members read floor speakers"
on public.bill_floor_speakers for select
using (class_id = public.my_class_id());

drop policy if exists "students request floor speaking slots" on public.bill_floor_speakers;
create policy "students request floor speaking slots"
on public.bill_floor_speakers for insert
with check (user_id = auth.uid() and class_id = public.my_class_id());

drop policy if exists "students update own floor speaking slots" on public.bill_floor_speakers;
create policy "students update own floor speaking slots"
on public.bill_floor_speakers for update
using (user_id = auth.uid() and class_id = public.my_class_id())
with check (user_id = auth.uid() and class_id = public.my_class_id());

drop policy if exists "students delete own floor speaking slots" on public.bill_floor_speakers;
create policy "students delete own floor speaking slots"
on public.bill_floor_speakers for delete
using (user_id = auth.uid() and class_id = public.my_class_id());

drop policy if exists "teachers and sponsors manage floor speakers" on public.bill_floor_speakers;
create policy "teachers and sponsors manage floor speakers"
on public.bill_floor_speakers for all
using (
  exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  or exists (select 1 from public.bills b where b.id = bill_id and b.author_user_id = auth.uid())
)
with check (
  exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  or exists (select 1 from public.bills b where b.id = bill_id and b.author_user_id = auth.uid())
);

drop policy if exists "class members read previous question votes" on public.bill_previous_question_votes;
create policy "class members read previous question votes"
on public.bill_previous_question_votes for select
using (class_id = public.my_class_id());

drop policy if exists "students cast previous question votes" on public.bill_previous_question_votes;
create policy "students cast previous question votes"
on public.bill_previous_question_votes for insert
with check (user_id = auth.uid() and class_id = public.my_class_id());

drop policy if exists "students update own previous question votes" on public.bill_previous_question_votes;
create policy "students update own previous question votes"
on public.bill_previous_question_votes for update
using (user_id = auth.uid() and class_id = public.my_class_id())
with check (user_id = auth.uid() and class_id = public.my_class_id());
