create table if not exists public.tochka_documents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  original_name text not null check (char_length(original_name) between 1 and 255),
  object_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists tochka_documents_user_created_idx on public.tochka_documents (user_id, created_at desc) where deleted_at is null;
alter table public.tochka_documents enable row level security;
revoke all on public.tochka_documents from anon;
grant select, insert, update, delete on public.tochka_documents to authenticated;
drop policy if exists "tochka_documents_select_own" on public.tochka_documents;
create policy "tochka_documents_select_own" on public.tochka_documents for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "tochka_documents_insert_own" on public.tochka_documents;
create policy "tochka_documents_insert_own" on public.tochka_documents for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "tochka_documents_update_own" on public.tochka_documents;
create policy "tochka_documents_update_own" on public.tochka_documents for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "tochka_documents_delete_own" on public.tochka_documents;
create policy "tochka_documents_delete_own" on public.tochka_documents for delete to authenticated using ((select auth.uid()) = user_id);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('tochka-documents','tochka-documents',false,20971520,array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "tochka_documents_objects_select_own" on storage.objects;
create policy "tochka_documents_objects_select_own" on storage.objects for select to authenticated using (bucket_id='tochka-documents' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists "tochka_documents_objects_insert_own" on storage.objects;
create policy "tochka_documents_objects_insert_own" on storage.objects for insert to authenticated with check (bucket_id='tochka-documents' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists "tochka_documents_objects_delete_own" on storage.objects;
create policy "tochka_documents_objects_delete_own" on storage.objects for delete to authenticated using (bucket_id='tochka-documents' and (storage.foldername(name))[1]=(select auth.uid()::text));
