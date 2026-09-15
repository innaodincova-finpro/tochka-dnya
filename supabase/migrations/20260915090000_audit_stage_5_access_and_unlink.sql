-- Audit stage 5: an old app session must not retain document access after
-- Tochka membership is revoked. Auth itself is shared with other applications.
drop policy if exists "tochka_documents_select_own" on public.tochka_documents;
create policy "tochka_documents_select_own" on public.tochka_documents
for select to authenticated using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  )
);

drop policy if exists "tochka_documents_insert_own" on public.tochka_documents;
create policy "tochka_documents_insert_own" on public.tochka_documents
for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  )
);

drop policy if exists "tochka_documents_update_own" on public.tochka_documents;
create policy "tochka_documents_update_own" on public.tochka_documents
for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  )
);

drop policy if exists "tochka_documents_delete_own" on public.tochka_documents;
create policy "tochka_documents_delete_own" on public.tochka_documents
for delete to authenticated using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  )
);

drop policy if exists "tochka_documents_objects_select_own" on storage.objects;
create policy "tochka_documents_objects_select_own" on storage.objects
for select to authenticated using (
  bucket_id = 'tochka-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  )
);

drop policy if exists "tochka_documents_objects_insert_own" on storage.objects;
create policy "tochka_documents_objects_insert_own" on storage.objects
for insert to authenticated with check (
  bucket_id = 'tochka-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  )
);

drop policy if exists "tochka_documents_objects_delete_own" on storage.objects;
create policy "tochka_documents_objects_delete_own" on storage.objects
for delete to authenticated using (
  bucket_id = 'tochka-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.tochka_members m
    where m.user_id = (select auth.uid()) and m.revoked_at is null
  )
);

-- The singleton reminder configuration belongs to the pilot. Removing a pilot
-- must clear that reference instead of blocking Telegram unlink.
alter table public.tochka_telegram_reminder_config
  drop constraint if exists tochka_telegram_reminder_config_owner_id_fkey;
alter table public.tochka_telegram_reminder_config
  add constraint tochka_telegram_reminder_config_owner_id_fkey
  foreign key (owner_id) references public.tochka_assistant_pilot(user_id)
  on delete cascade;
