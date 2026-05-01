alter table public.dear_colleague_letters
  add column if not exists parent_letter_id uuid references public.dear_colleague_letters(id) on delete set null;

create index if not exists dear_colleague_letters_parent_letter_id_idx
  on public.dear_colleague_letters(parent_letter_id);
