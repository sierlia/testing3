drop policy if exists "authors update draft bills" on public.bills;
create policy "authors update draft bills" on public.bills
for update
using (
  author_user_id = auth.uid()
  and class_id = public.my_class_id()
  and status = 'draft'
)
with check (
  author_user_id = auth.uid()
  and class_id = public.my_class_id()
  and status in ('draft', 'submitted')
);
