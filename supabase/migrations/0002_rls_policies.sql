-- =============================================================================
-- Migration: Row Level Security policies
-- Covers every table created in 0001_initial_schema.sql.
--
-- Design notes:
-- * Every policy uses `(select auth.uid())` rather than bare `auth.uid()` so
--   Postgres can evaluate it once per statement (initPlan) instead of once
--   per row.
-- * `to authenticated` / `to anon` is used instead of the deprecated
--   `auth.role() = ...` pattern.
-- * Admin routes (see CLAUDE.md's `(admin)` layout) go through the
--   service-role client, which bypasses RLS entirely. The `is_admin()`
--   escape hatches below are defense-in-depth for the case where admin
--   pages read data with the regular session-bound client, not the primary
--   access path for admin writes.
-- * RLS structurally cannot express "this column may never change on
--   UPDATE" (USING sees the old row, WITH CHECK sees the new row, but
--   nothing lets one expression see both). Anywhere the schema promises a
--   value is immutable after insert (snapshot pricing, ledger rows, a
--   user's role), a trigger enforces it instead. See
--   `prevent_column_updates()` below.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------

-- SECURITY INVOKER (default) is deliberate: this must run as the calling user
-- so RLS on `users` still applies. It only ever looks up the caller's own row
-- (id = auth.uid()), which the "users read own row" policy below always
-- allows, so this never needs SECURITY DEFINER / RLS-bypass.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security invoker
set search_path = ''
as $$
  select role from public.users where id = (select auth.uid())
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

-- Generic "protect these columns from UPDATE" trigger, reused on every table
-- where some columns must stay fixed after insert while others (status,
-- timestamps, etc.) legitimately change. The service_role escape hatch lets
-- the admin backend (lib/supabase/admin.ts) perform trusted corrections;
-- every other Postgres role is blocked.
create or replace function public.prevent_column_updates()
returns trigger
language plpgsql
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

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
-- NOTE: this intentionally does not expose other users' rows (email,
-- phone_number, password_hash placeholder are all sensitive). Public gig/
-- creator browsing needs display name + avatar only -- add a
-- `security_invoker` view exposing just those two columns when gig browsing
-- is built; that's a follow-up, not part of this migration.

alter table public.users enable row level security;

create policy "users_select_own_or_admin"
on public.users for select
to authenticated
using ( (select auth.uid()) = id or public.is_admin() );

-- Row must exist before signup can insert into public.users; if the project
-- requires email confirmation before a session exists, this policy alone
-- won't cover the signup insert (auth.uid() is null with no session yet) and
-- lib/auth/actions.ts will need to use the service-role client for that one
-- insert instead. Flagging here since it depends on the Auth confirmation
-- setting, not on anything visible in this migration.
create policy "users_insert_self"
on public.users for insert
to authenticated
with check ( (select auth.uid()) = id );

create policy "users_update_own_or_admin"
on public.users for update
to authenticated
using ( (select auth.uid()) = id or public.is_admin() )
with check ( (select auth.uid()) = id or public.is_admin() );

-- Prevents a user from granting themselves admin/creator/brand via a plain
-- profile-edit UPDATE. Role changes must go through the service-role client.
create trigger trg_users_protect_role
  before update on public.users
  for each row execute function public.prevent_column_updates('role');

-- -----------------------------------------------------------------------------
-- niches / languages (admin-curated lookup tables)
-- -----------------------------------------------------------------------------

alter table public.niches enable row level security;
alter table public.languages enable row level security;

create policy "niches_select_active_or_admin"
on public.niches for select
to anon, authenticated
using ( is_active or public.is_admin() );

create policy "niches_write_admin"
on public.niches for all
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

create policy "languages_select_all"
on public.languages for select
to anon, authenticated
using ( true );

create policy "languages_write_admin"
on public.languages for all
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

-- -----------------------------------------------------------------------------
-- creator_profiles / brand_profiles
-- -----------------------------------------------------------------------------

alter table public.creator_profiles enable row level security;
alter table public.brand_profiles enable row level security;

-- Public: bio/rating/portfolio are marketing content meant to be browsed
-- alongside gigs, unlike the parent `users` row.
create policy "creator_profiles_select_public"
on public.creator_profiles for select
to anon, authenticated
using ( true );

create policy "creator_profiles_insert_self"
on public.creator_profiles for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and public.current_user_role() = 'creator'
);

create policy "creator_profiles_update_own_or_admin"
on public.creator_profiles for update
to authenticated
using ( (select auth.uid()) = user_id or public.is_admin() )
with check ( (select auth.uid()) = user_id or public.is_admin() );

-- Brands don't have public storefronts (only gigs/creators are browsed), so
-- brand_profiles is visible to its owner, admin, and any creator they
-- actually have an order or inquiry with.
create policy "brand_profiles_select_own_or_related"
on public.brand_profiles for select
to authenticated
using (
  (select auth.uid()) = user_id
  or public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.brand_id = brand_profiles.user_id
      and o.creator_id = (select auth.uid())
  )
  or exists (
    select 1 from public.conversations c
    where c.brand_id = brand_profiles.user_id
      and c.creator_id = (select auth.uid())
  )
);

create policy "brand_profiles_insert_self"
on public.brand_profiles for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and public.current_user_role() = 'brand'
);

create policy "brand_profiles_update_own_or_admin"
on public.brand_profiles for update
to authenticated
using ( (select auth.uid()) = user_id or public.is_admin() )
with check ( (select auth.uid()) = user_id or public.is_admin() );

-- -----------------------------------------------------------------------------
-- gigs / gig_languages / gig_packages
-- -----------------------------------------------------------------------------

alter table public.gigs enable row level security;
alter table public.gig_languages enable row level security;
alter table public.gig_packages enable row level security;

create policy "gigs_select_active_or_owner_or_admin"
on public.gigs for select
to anon, authenticated
using (
  status = 'active'
  or (select auth.uid()) = creator_id
  or public.is_admin()
);

create policy "gigs_insert_own"
on public.gigs for insert
to authenticated
with check (
  (select auth.uid()) = creator_id
  and public.current_user_role() = 'creator'
);

create policy "gigs_update_own_or_admin"
on public.gigs for update
to authenticated
using ( (select auth.uid()) = creator_id or public.is_admin() )
with check ( (select auth.uid()) = creator_id or public.is_admin() );

create policy "gigs_delete_own_or_admin"
on public.gigs for delete
to authenticated
using ( (select auth.uid()) = creator_id or public.is_admin() );

-- gig_languages / gig_packages mirror the parent gig's visibility and
-- ownership rather than duplicating creator_id on every row.

create policy "gig_languages_select_mirrors_gig"
on public.gig_languages for select
to anon, authenticated
using (
  exists (
    select 1 from public.gigs g
    where g.id = gig_languages.gig_id
      and (g.status = 'active' or (select auth.uid()) = g.creator_id or public.is_admin())
  )
);

create policy "gig_languages_write_owner_or_admin"
on public.gig_languages for all
to authenticated
using (
  exists (
    select 1 from public.gigs g
    where g.id = gig_languages.gig_id
      and ((select auth.uid()) = g.creator_id or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.gigs g
    where g.id = gig_languages.gig_id
      and ((select auth.uid()) = g.creator_id or public.is_admin())
  )
);

create policy "gig_packages_select_mirrors_gig"
on public.gig_packages for select
to anon, authenticated
using (
  exists (
    select 1 from public.gigs g
    where g.id = gig_packages.gig_id
      and (g.status = 'active' or (select auth.uid()) = g.creator_id or public.is_admin())
  )
);

create policy "gig_packages_write_owner_or_admin"
on public.gig_packages for all
to authenticated
using (
  exists (
    select 1 from public.gigs g
    where g.id = gig_packages.gig_id
      and ((select auth.uid()) = g.creator_id or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.gigs g
    where g.id = gig_packages.gig_id
      and ((select auth.uid()) = g.creator_id or public.is_admin())
  )
);

-- -----------------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------------

alter table public.orders enable row level security;

create policy "orders_select_party_or_admin"
on public.orders for select
to authenticated
using (
  (select auth.uid()) = brand_id
  or (select auth.uid()) = creator_id
  or public.is_admin()
);

-- A brand can only open an order against a real package on a real gig, for
-- that gig's actual creator, at that package's current price. commission_rate
-- / commission_amount_dzd / creator_payout_dzd aren't independently checkable
-- here -- there's no platform-commission-rate table in this schema to verify
-- against, so that stays an app-level responsibility (see CLAUDE.md).
create policy "orders_insert_brand"
on public.orders for insert
to authenticated
with check (
  (select auth.uid()) = brand_id
  and public.current_user_role() = 'brand'
  and exists (
    select 1
    from public.gig_packages gp
    join public.gigs g on g.id = gp.gig_id
    where gp.id = orders.gig_package_id
      and gp.gig_id = orders.gig_id
      and g.creator_id = orders.creator_id
      and gp.price_dzd = orders.price_dzd
      and g.status = 'active'
  )
);

create policy "orders_update_party_or_admin"
on public.orders for update
to authenticated
using (
  (select auth.uid()) = brand_id
  or (select auth.uid()) = creator_id
  or public.is_admin()
)
with check (
  (select auth.uid()) = brand_id
  or (select auth.uid()) = creator_id
  or public.is_admin()
);

-- Status transitions are validated in application code (see CLAUDE.md); this
-- only locks the snapshot fields that must never change once the order
-- exists, regardless of which party's client issues the UPDATE.
create trigger trg_orders_protect_snapshot
  before update on public.orders
  for each row execute function public.prevent_column_updates(
    'brand_id', 'creator_id', 'gig_id', 'gig_package_id',
    'price_dzd', 'commission_rate', 'commission_amount_dzd', 'creator_payout_dzd',
    'revisions_included', 'created_at'
  );

-- No delete policy: orders are never hard-deleted, only moved to 'cancelled'.

-- -----------------------------------------------------------------------------
-- order_status_history (append-only audit log)
-- -----------------------------------------------------------------------------

alter table public.order_status_history enable row level security;

create policy "order_status_history_select_party_or_admin"
on public.order_status_history for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and ((select auth.uid()) = o.brand_id or (select auth.uid()) = o.creator_id or public.is_admin())
  )
);

create policy "order_status_history_insert_party_or_admin"
on public.order_status_history for insert
to authenticated
with check (
  ( changed_by = (select auth.uid()) or public.is_admin() )
  and exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and ((select auth.uid()) = o.brand_id or (select auth.uid()) = o.creator_id or public.is_admin())
  )
);

-- No update/delete policy: history rows are immutable once written.

-- -----------------------------------------------------------------------------
-- order_deliverables
-- -----------------------------------------------------------------------------

alter table public.order_deliverables enable row level security;

create policy "order_deliverables_select_party_or_admin"
on public.order_deliverables for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_deliverables.order_id
      and ((select auth.uid()) = o.brand_id or (select auth.uid()) = o.creator_id or public.is_admin())
  )
);

-- Only the order's creator uploads deliverables.
create policy "order_deliverables_insert_creator"
on public.order_deliverables for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.orders o
    where o.id = order_deliverables.order_id
      and o.creator_id = (select auth.uid())
  )
);

-- No update/delete policy: delivery history is immutable; revisions add new
-- rows (higher revision_round) rather than editing old ones.

-- -----------------------------------------------------------------------------
-- conversations / messages
-- -----------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "conversations_select_party_or_admin"
on public.conversations for select
to authenticated
using (
  (select auth.uid()) = brand_id
  or (select auth.uid()) = creator_id
  or public.is_admin()
);

create policy "conversations_insert_party"
on public.conversations for insert
to authenticated
with check (
  (select auth.uid()) = brand_id or (select auth.uid()) = creator_id
);

-- Only last_message_at should move after creation; parties/order_id are fixed.
create policy "conversations_update_party"
on public.conversations for update
to authenticated
using ( (select auth.uid()) = brand_id or (select auth.uid()) = creator_id )
with check ( (select auth.uid()) = brand_id or (select auth.uid()) = creator_id );

create trigger trg_conversations_protect_parties
  before update on public.conversations
  for each row execute function public.prevent_column_updates(
    'brand_id', 'creator_id', 'order_id', 'created_at'
  );

create policy "messages_select_participant_or_admin"
on public.messages for select
to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and ((select auth.uid()) = c.brand_id or (select auth.uid()) = c.creator_id or public.is_admin())
  )
);

create policy "messages_insert_participant"
on public.messages for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and ((select auth.uid()) = c.brand_id or (select auth.uid()) = c.creator_id)
  )
);

-- Either participant can mark a message read; nothing else about a message
-- (body, sender, attachment) may change after it's sent.
create policy "messages_update_participant"
on public.messages for update
to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and ((select auth.uid()) = c.brand_id or (select auth.uid()) = c.creator_id)
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and ((select auth.uid()) = c.brand_id or (select auth.uid()) = c.creator_id)
  )
);

create trigger trg_messages_protect_content
  before update on public.messages
  for each row execute function public.prevent_column_updates(
    'conversation_id', 'sender_id', 'body', 'attachment_url', 'created_at'
  );

-- -----------------------------------------------------------------------------
-- reviews
-- -----------------------------------------------------------------------------

alter table public.reviews enable row level security;

-- Public: reviews are social proof for gig browsing, same spirit as
-- creator_profiles.
create policy "reviews_select_public"
on public.reviews for select
to anon, authenticated
using ( true );

-- Reviewer must be a genuine party to a completed order, and reviewer/
-- reviewee/direction must line up with that order's actual brand/creator --
-- otherwise a brand could post a "creator_to_brand" review of themselves.
create policy "reviews_insert_party_on_completed_order"
on public.reviews for insert
to authenticated
with check (
  reviewer_id = (select auth.uid())
  and exists (
    select 1 from public.orders o
    where o.id = reviews.order_id
      and o.status = 'completed'
      and (
        (reviews.direction = 'brand_to_creator' and o.brand_id = reviews.reviewer_id and o.creator_id = reviews.reviewee_id)
        or
        (reviews.direction = 'creator_to_brand' and o.creator_id = reviews.reviewer_id and o.brand_id = reviews.reviewee_id)
      )
  )
);

-- No update/delete policy: reviews are immutable once posted.

-- -----------------------------------------------------------------------------
-- disputes
-- -----------------------------------------------------------------------------

alter table public.disputes enable row level security;

create policy "disputes_select_party_or_admin"
on public.disputes for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = disputes.order_id
      and ((select auth.uid()) = o.brand_id or (select auth.uid()) = o.creator_id or public.is_admin())
  )
);

create policy "disputes_insert_party"
on public.disputes for insert
to authenticated
with check (
  raised_by = (select auth.uid())
  and status = 'open'
  and exists (
    select 1 from public.orders o
    where o.id = disputes.order_id
      and ((select auth.uid()) = o.brand_id or (select auth.uid()) = o.creator_id)
  )
);

-- Only admin resolves a dispute (status/resolution_note/resolved_by/resolved_at).
create policy "disputes_update_admin"
on public.disputes for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

create trigger trg_disputes_protect_origin
  before update on public.disputes
  for each row execute function public.prevent_column_updates(
    'order_id', 'raised_by', 'reason', 'created_at'
  );

-- -----------------------------------------------------------------------------
-- creator_payout_accounts
-- -----------------------------------------------------------------------------

alter table public.creator_payout_accounts enable row level security;

-- Admin can view (needed to actually send a payout) but never edit a
-- creator's bank details.
create policy "payout_accounts_select_own_or_admin"
on public.creator_payout_accounts for select
to authenticated
using ( (select auth.uid()) = creator_id or public.is_admin() );

create policy "payout_accounts_write_own"
on public.creator_payout_accounts for all
to authenticated
using ( (select auth.uid()) = creator_id )
with check ( (select auth.uid()) = creator_id );

-- -----------------------------------------------------------------------------
-- payouts
-- -----------------------------------------------------------------------------

alter table public.payouts enable row level security;

create policy "payouts_select_own_or_admin"
on public.payouts for select
to authenticated
using ( (select auth.uid()) = creator_id or public.is_admin() );

create policy "payouts_insert_own"
on public.payouts for insert
to authenticated
with check (
  (select auth.uid()) = creator_id
  and status = 'pending'
  and exists (
    select 1 from public.creator_payout_accounts a
    where a.id = payouts.payout_account_id
      and a.creator_id = (select auth.uid())
  )
);

-- Only admin processes a payout (status/processed_by/processed_at/proof_image_url).
create policy "payouts_update_admin"
on public.payouts for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

create trigger trg_payouts_protect_request
  before update on public.payouts
  for each row execute function public.prevent_column_updates(
    'creator_id', 'payout_account_id', 'amount_dzd', 'requested_at'
  );

-- -----------------------------------------------------------------------------
-- transactions (ledger)
-- -----------------------------------------------------------------------------

alter table public.transactions enable row level security;

create policy "transactions_select_party_or_admin"
on public.transactions for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = transactions.order_id
      and ((select auth.uid()) = o.brand_id or (select auth.uid()) = o.creator_id)
  )
  or exists (
    select 1 from public.payouts p
    where p.id = transactions.payout_id
      and p.creator_id = (select auth.uid())
  )
);

-- A brand can submit proof of their own manual transfer, but only as
-- 'pending' -- moving a transaction to 'confirmed' happens exclusively via
-- transactions_update_admin below, per CLAUDE.md's "treat 'money moved' as
-- status = 'confirmed', not merely 'row exists'".
create policy "transactions_insert_brand_escrow_hold"
on public.transactions for insert
to authenticated
with check (
  type = 'escrow_hold'
  and status = 'pending'
  and exists (
    select 1 from public.orders o
    where o.id = transactions.order_id
      and o.brand_id = (select auth.uid())
  )
);

-- Only admin confirms/rejects a transaction.
create policy "transactions_update_admin"
on public.transactions for update
to authenticated
using ( public.is_admin() )
with check ( public.is_admin() );

create trigger trg_transactions_protect_ledger
  before update on public.transactions
  for each row execute function public.prevent_column_updates(
    'order_id', 'payout_id', 'type', 'amount_dzd',
    'payment_method', 'reference_number', 'proof_image_url', 'created_at'
  );

-- No delete policy: the ledger is never deleted.

-- -----------------------------------------------------------------------------
-- creator_wallets
-- -----------------------------------------------------------------------------

alter table public.creator_wallets enable row level security;

-- Read-only for everyone except the trusted backend: balances must only ever
-- move in lockstep with a confirmed transaction (see CLAUDE.md), which is
-- backend logic running under the service-role client, not a user-facing
-- write path. No insert/update/delete policy is granted here on purpose.
create policy "creator_wallets_select_own_or_admin"
on public.creator_wallets for select
to authenticated
using ( (select auth.uid()) = creator_id or public.is_admin() );
