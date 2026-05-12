drop policy if exists "students delete own previous question votes" on public.bill_previous_question_votes;
create policy "students delete own previous question votes"
on public.bill_previous_question_votes for delete
using (user_id = auth.uid() and class_id = public.my_class_id());
