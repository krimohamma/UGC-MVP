-- =============================================================================
-- Migration: Portfolio storage bucket
--
-- Buckets and their access policies are rows/RLS in the `storage` schema
-- (storage.buckets, storage.objects), so — same as everything else in this
-- project — they belong in a migration, not a dashboard click. A
-- dashboard-configured bucket is invisible in review and doesn't survive a
-- project recreate.
--
-- Objects live at `{creator_id}/{filename}` in the `portfolio` bucket; RLS
-- on storage.objects checks that path prefix against auth.uid() so a
-- creator can only write/delete inside their own folder.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio',
  'portfolio',
  true, -- public read: sample videos are marketing content, same as portfolio_items rows
  104857600, -- 100 MB in bytes. Comfortable for a 30-60s UGC clip; blocks accidental raw exports.
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by default on every Supabase
-- project; only policies need adding.

create policy "portfolio_objects_select_public"
on storage.objects for select
to anon, authenticated
using ( bucket_id = 'portfolio' );

create policy "portfolio_objects_insert_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'portfolio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.current_user_role() = 'creator'
);

create policy "portfolio_objects_update_own_folder_or_admin"
on storage.objects for update
to authenticated
using (
  bucket_id = 'portfolio'
  and ( (storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin() )
)
with check (
  bucket_id = 'portfolio'
  and ( (storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin() )
);

create policy "portfolio_objects_delete_own_folder_or_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'portfolio'
  and ( (storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin() )
);
