-- =============================================================================
-- Migration: Creator portfolio items
--
-- A single `creator_profiles.portfolio_url` text field can't support what a
-- UGC marketplace actually needs: multiple sample videos, reorderable, with
-- either an uploaded file or an external TikTok/IG link. Brands deciding
-- whether to order need to watch a creator's past work, not follow one link
-- off-platform. This replaces that column with a proper table.
-- =============================================================================

alter table public.creator_profiles drop column portfolio_url;

create table public.portfolio_items (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references public.users(id) on delete cascade,
  title          text,
  video_url      text,       -- uploaded to a storage bucket (wired up when the upload UI is built)
  thumbnail_url  text,
  external_url   text,       -- alternative to video_url: a TikTok/IG post link
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint portfolio_items_has_a_source
    check (video_url is not null or external_url is not null)
);

create index idx_portfolio_items_creator on public.portfolio_items (creator_id, sort_order);

create trigger trg_portfolio_items_updated_at before update on public.portfolio_items
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS -- same shape as creator_profiles: public marketing content, owner-
-- writable, admin can moderate.
-- -----------------------------------------------------------------------------

alter table public.portfolio_items enable row level security;

create policy "portfolio_items_select_public"
on public.portfolio_items for select
to anon, authenticated
using ( true );

create policy "portfolio_items_insert_own"
on public.portfolio_items for insert
to authenticated
with check (
  (select auth.uid()) = creator_id
  and public.current_user_role() = 'creator'
);

create policy "portfolio_items_update_own_or_admin"
on public.portfolio_items for update
to authenticated
using ( (select auth.uid()) = creator_id or public.is_admin() )
with check ( (select auth.uid()) = creator_id or public.is_admin() );

create policy "portfolio_items_delete_own_or_admin"
on public.portfolio_items for delete
to authenticated
using ( (select auth.uid()) = creator_id or public.is_admin() );
