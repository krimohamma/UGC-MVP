-- =============================================================================
-- Migration 0010: In-app notifications.
--
-- Pre-approved (no notifications table existed): a user-owned inbox row per
-- event (order status changes, new deliveries, reviews, payouts, ...).
-- Deliberately no email/SMS here — that's a distinct, unbuilt integration.
--
-- `type` is plain text, not an enum: unlike order_status (a real state
-- machine with DB-relevant transitions), a notification's type is just an
-- app-level tag for icon/routing choices in the UI, and is likely to grow
-- often — an enum would mean a migration per new notification kind for no
-- corresponding DB-level benefit.
--
-- INSERT is service-role only (no policy granted to authenticated/anon —
-- default-deny), per the task's own instruction: notifications are created
-- by trusted backend code reacting to verified events (see
-- lib/actions/notifications.ts's create() helper), never by a user directly
-- claiming "notify me of X".
-- =============================================================================

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link_url    text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_notifications_user_created on public.notifications (user_id, created_at desc);
create index idx_notifications_user_unread on public.notifications (user_id) where not is_read;

alter table public.notifications enable row level security;

create policy "notifications_select_own"
on public.notifications for select
to authenticated
using ( (select auth.uid()) = user_id );

-- Only is_read is meant to change (mark as read/unread from the UI); every
-- other column is locked via the existing prevent_column_updates() trigger
-- (same function already used for messages/orders/etc. — see 0002/0007).
create policy "notifications_update_own"
on public.notifications for update
to authenticated
using ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id );

create trigger trg_notifications_protect_content
  before update on public.notifications
  for each row execute function public.prevent_column_updates(
    'user_id', 'type', 'title', 'body', 'link_url', 'created_at'
  );

-- No insert/delete policy for authenticated/anon: creation is service-role
-- only (default-deny covers this), and notifications aren't user-deletable
-- for now — only the read/unread toggle is.
