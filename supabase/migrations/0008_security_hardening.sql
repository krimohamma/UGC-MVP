-- =============================================================================
-- Migration 0008: Security hygiene — close the remaining advisor WARNs.
--
-- Fixes (see CLAUDE.md "Known follow-ups" for the advisor run this responds to):
--  1. `set_updated_at` / `prevent_column_updates` had mutable search_path.
--     Behavior is unchanged — neither function's body references any object
--     by an unqualified name that resolves differently under a locked-down
--     search_path (NEW/OLD/TG_ARGV/TG_RELID are PL/pgSQL specials, and
--     to_jsonb()/now()/regclass are pg_catalog builtins, always resolvable
--     regardless of search_path). This is purely closing the WARN, not a
--     functional change.
--  2. `portfolio_objects_select_public` had no restriction beyond bucket_id,
--     so any anon/authenticated caller could `.list()` the bucket and
--     enumerate every creator's folder. Replaced with an owner-or-admin
--     SELECT policy. This does NOT affect public read of individual files by
--     direct URL — `portfolio` is a `public = true` bucket, and Supabase
--     serves object GETs for public buckets straight from the bucket flag,
--     bypassing storage.objects RLS entirely. Browse/gig pages render
--     `portfolio_items.video_url`/`thumbnail_url` directly as `<video src>`/
--     `<img src>` (confirmed: no code path calls `.list()` on this bucket),
--     so removing the broad listing policy has no user-visible effect.
--
-- `citext` remains installed in `public` (from 0001) — left as-is; see
-- CLAUDE.md for why this WARN is accepted rather than fixed.
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_column_updates()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text;
begin
  if current_user = 'service_role' then
    return new;
  end if;

  foreach col in array tg_argv loop
    if to_jsonb(new) -> col is distinct from to_jsonb(old) -> col then
      raise exception 'column "%" is immutable on table "%"', col, tg_relid::regclass;
    end if;
  end loop;

  return new;
end;
$$;

drop policy "portfolio_objects_select_public" on storage.objects;

create policy "portfolio_objects_select_own_or_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'portfolio'
  and ( (storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin() )
);
