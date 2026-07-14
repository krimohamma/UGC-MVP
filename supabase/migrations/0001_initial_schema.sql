-- =============================================================================
-- Schema: UGC creator <-> brand freelance marketplace (Algeria)
-- Target: PostgreSQL 14+
-- =============================================================================

create extension if not exists pgcrypto; -- gen_random_uuid()
create extension if not exists citext;   -- case-insensitive email

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type user_role as enum ('creator', 'brand', 'admin');
create type locale as enum ('fr', 'ar', 'en');

create type gig_status as enum ('draft', 'active', 'paused', 'archived');
create type package_tier as enum ('basic', 'standard', 'premium');

create type order_status as enum (
  'pending_payment',
  'in_progress',
  'delivered',
  'revision_requested',
  'completed',
  'cancelled',
  'disputed'
);

create type review_direction as enum ('brand_to_creator', 'creator_to_brand');
create type dispute_status as enum ('open', 'resolved');

create type payout_method as enum ('ccp', 'baridimob');
create type payout_status as enum ('pending', 'processing', 'paid', 'rejected');

create type transaction_type as enum ('escrow_hold', 'escrow_release', 'refund', 'commission', 'payout');
create type transaction_status as enum ('pending', 'confirmed', 'rejected');

-- -----------------------------------------------------------------------------
-- updated_at helper
-- -----------------------------------------------------------------------------

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- Users & profiles
-- -----------------------------------------------------------------------------

create table users (
  id             uuid primary key default gen_random_uuid(),
  role           user_role not null,
  email          citext unique not null,
  phone_number   text unique,
  password_hash  text not null,
  full_name      text not null,
  locale         locale not null default 'fr',
  avatar_url     text,
  is_active      boolean not null default true,
  is_verified    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

-- Static lookup tables (admin-curated, so bilingual name columns are appropriate here)

create table niches (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name_fr    text not null,
  name_ar    text not null,
  name_en    text not null,
  is_active  boolean not null default true
);

create table languages (
  code     text primary key,       -- 'fr', 'ar', 'en', 'dz-ar' (Darja), ...
  name_fr  text not null,
  name_ar  text not null,
  name_en  text not null
);

-- One-to-one extension tables, keyed by users.id.
-- App layer must ensure creator_profiles rows only exist for users.role = 'creator'
-- (and brand_profiles only for role = 'brand') -- not enforceable as a plain FK/check.

create table creator_profiles (
  user_id                 uuid primary key references users(id) on delete cascade,
  bio                     text,
  niche_id                uuid references niches(id),
  years_experience        smallint,
  portfolio_url           text,
  rating_avg              numeric(3,2) not null default 0,   -- denormalized, updated on review insert
  rating_count            integer not null default 0,
  completed_orders_count  integer not null default 0,        -- denormalized, updated on order completion
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger trg_creator_profiles_updated_at before update on creator_profiles
  for each row execute function set_updated_at();

create table brand_profiles (
  user_id         uuid primary key references users(id) on delete cascade,
  store_name      text not null,
  store_niche_id  uuid references niches(id),
  website_url     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_brand_profiles_updated_at before update on brand_profiles
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- Gigs & packages
-- -----------------------------------------------------------------------------

create table gigs (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references users(id) on delete cascade,
  niche_id         uuid not null references niches(id),
  title            text not null,
  description      text not null,
  status           gig_status not null default 'draft',
  cover_media_url  text,
  base_price_dzd   integer not null,     -- denormalized min(gig_packages.price_dzd), kept in sync by app
  avg_rating       numeric(3,2) not null default 0,
  orders_count     integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_gigs_browse on gigs (niche_id, status, base_price_dzd);
create index idx_gigs_creator on gigs (creator_id);

create trigger trg_gigs_updated_at before update on gigs
  for each row execute function set_updated_at();

-- Which content language(s) a gig is delivered in (drives the "browse by language" filter)
create table gig_languages (
  gig_id         uuid not null references gigs(id) on delete cascade,
  language_code  text not null references languages(code),
  primary key (gig_id, language_code)
);

create table gig_packages (
  id                   uuid primary key default gen_random_uuid(),
  gig_id               uuid not null references gigs(id) on delete cascade,
  tier                 package_tier not null,
  title                text not null,
  description          text not null,
  price_dzd            integer not null check (price_dzd > 0),
  delivery_days        smallint not null check (delivery_days > 0),
  revisions_included   smallint not null default 0,
  features             text[] not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (gig_id, tier)
);

create trigger trg_gig_packages_updated_at before update on gig_packages
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------

create table orders (
  id                    uuid primary key default gen_random_uuid(),
  brand_id              uuid not null references users(id),
  creator_id            uuid not null references users(id),   -- denormalized from gig for query convenience
  gig_id                uuid not null references gigs(id),
  gig_package_id        uuid not null references gig_packages(id),
  status                order_status not null default 'pending_payment',

  -- price/commission snapshot at order time (must survive later gig/package edits)
  price_dzd             integer not null,
  commission_rate       numeric(5,4) not null,
  commission_amount_dzd integer not null,
  creator_payout_dzd    integer not null,

  revisions_included    smallint not null,
  revisions_used        smallint not null default 0,
  requirements          text,        -- brief provided by the brand

  due_at                timestamptz,
  delivered_at          timestamptz,
  completed_at          timestamptz,
  cancelled_at          timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_orders_brand on orders (brand_id, status);
create index idx_orders_creator on orders (creator_id, status);

create trigger trg_orders_updated_at before update on orders
  for each row execute function set_updated_at();

-- Audit trail of lifecycle transitions (pending_payment -> in_progress -> delivered
-- -> revision_requested -> completed, plus cancelled/disputed side paths).
-- Valid transitions are enforced at the application layer, not in SQL.
create table order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  from_status order_status,
  to_status   order_status not null,
  changed_by  uuid references users(id),   -- null for system-triggered transitions
  note        text,
  created_at  timestamptz not null default now()
);

create index idx_order_status_history_order on order_status_history (order_id, created_at);

-- Delivered files (videos, etc). revision_round 0 = initial delivery, N = after Nth revision request.
create table order_deliverables (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  uploaded_by     uuid not null references users(id),
  file_url        text not null,
  file_type       text not null default 'video',
  revision_round  smallint not null default 0,
  note            text,
  created_at      timestamptz not null default now()
);

create index idx_order_deliverables_order on order_deliverables (order_id);

-- -----------------------------------------------------------------------------
-- Messaging
-- -----------------------------------------------------------------------------

-- order_id is nullable to allow pre-order inquiry threads between a brand and creator.
create table conversations (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references users(id),
  creator_id       uuid not null references users(id),
  order_id         uuid references orders(id),
  last_message_at  timestamptz,
  created_at       timestamptz not null default now()
);

-- one conversation per (brand, creator, order); pre-order inquiries (order_id null)
-- are deduplicated on (brand_id, creator_id) via the partial index below.
create unique index uq_conversations_order on conversations (brand_id, creator_id, order_id)
  where order_id is not null;
create unique index uq_conversations_inquiry on conversations (brand_id, creator_id)
  where order_id is null;

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender_id        uuid not null references users(id),
  body             text,
  attachment_url   text,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index idx_messages_conversation on messages (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- Reviews & disputes
-- -----------------------------------------------------------------------------

create table reviews (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  direction    review_direction not null,
  reviewer_id  uuid not null references users(id),
  reviewee_id  uuid not null references users(id),
  rating       smallint not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now(),
  unique (order_id, direction)
);

create index idx_reviews_reviewee on reviews (reviewee_id);

create table disputes (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id),
  raised_by        uuid not null references users(id),
  reason           text not null,
  status           dispute_status not null default 'open',
  resolution_note  text,
  resolved_by      uuid references users(id),
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index idx_disputes_order on disputes (order_id);

-- -----------------------------------------------------------------------------
-- Payouts & transactions (manual, admin-confirmed escrow)
-- -----------------------------------------------------------------------------

create table creator_payout_accounts (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references users(id) on delete cascade,
  method              payout_method not null,
  account_holder_name text not null,
  account_number      text not null,   -- CCP account number or BaridiMob RIP
  is_default          boolean not null default false,
  created_at          timestamptz not null default now()
);

create index idx_payout_accounts_creator on creator_payout_accounts (creator_id);

create table payouts (
  id                 uuid primary key default gen_random_uuid(),
  creator_id         uuid not null references users(id),
  payout_account_id  uuid not null references creator_payout_accounts(id),
  amount_dzd         integer not null check (amount_dzd > 0),
  status             payout_status not null default 'pending',
  requested_at       timestamptz not null default now(),
  processed_by       uuid references users(id),   -- admin who transferred the funds
  processed_at       timestamptz,
  proof_image_url    text                          -- admin's transfer confirmation screenshot
);

create index idx_payouts_creator on payouts (creator_id, status);

-- Ledger of money movement: brand escrow deposits, escrow release to creator,
-- refunds, platform commission, and payouts to creators. Manual payments are
-- confirmed by an admin (status + confirmed_by/confirmed_at + proof screenshot).
create table transactions (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid references orders(id),
  payout_id        uuid references payouts(id),
  type             transaction_type not null,
  amount_dzd       integer not null,
  status           transaction_status not null default 'pending',
  payment_method   payout_method,     -- set for escrow_hold/refund (how the brand paid in)
  reference_number text,              -- external CCP/BaridiMob transfer reference
  proof_image_url  text,              -- screenshot of the manual transfer
  confirmed_by     uuid references users(id),
  confirmed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index idx_transactions_order on transactions (order_id);
create index idx_transactions_status on transactions (status);

-- Denormalized running balance per creator, updated whenever a transaction
-- affecting them is confirmed. Avoids re-summing the ledger on every page load.
create table creator_wallets (
  creator_id             uuid primary key references users(id) on delete cascade,
  available_balance_dzd  integer not null default 0,   -- withdrawable now
  pending_balance_dzd    integer not null default 0,   -- held in escrow on active orders
  updated_at             timestamptz not null default now()
);

create trigger trg_creator_wallets_updated_at before update on creator_wallets
  for each row execute function set_updated_at();
