-- Private Storage policies for user avatars and simulation PDF uploads.

update storage.buckets
set public = false
where id = 'avatars';

drop policy if exists "authenticated users read app uploads" on storage.objects;
drop policy if exists "users upload own avatars" on storage.objects;
drop policy if exists "users update own avatars" on storage.objects;
drop policy if exists "users delete own avatars" on storage.objects;
drop policy if exists "class members upload simulation pdfs" on storage.objects;
drop policy if exists "class members read simulation pdfs" on storage.objects;

create policy "class members read avatars"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and exists (
    select 1
    from public.profiles owner_profile
    where owner_profile.user_id::text = (storage.foldername(name))[1]
      and (
        owner_profile.user_id = auth.uid()
        or owner_profile.class_id = public.my_class_id()
      )
  )
);

create policy "users upload own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users update own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "class members read simulation pdfs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'simulation-pdfs'
  and (storage.foldername(name))[1] = public.my_class_id()::text
);

create policy "class members upload simulation pdfs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'simulation-pdfs'
  and (storage.foldername(name))[1] = public.my_class_id()::text
);
