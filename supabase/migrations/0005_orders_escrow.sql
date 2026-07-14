-- =============================================================================
-- Migration 0005: Escrow infrastructure
-- Creates the receipts bucket and the RPC for safely confirming escrow holds.
--
-- SECURITY NOTE: `confirm_escrow_payment` moves money and is SECURITY DEFINER
-- (it must bypass RLS to touch transactions/orders/creator_wallets atomically).
-- Postgres grants EXECUTE on new functions to PUBLIC by default, which would
-- expose it through PostgREST to *any* authenticated user — a brand could
-- confirm their own escrow. So it is explicitly revoked from public/anon/
-- authenticated and granted only to service_role (the trusted backend, see
-- lib/supabase/admin.ts), with an in-function guard as defense in depth.
--
-- The guard accepts service_role OR a genuine admin session: the app calls
-- this via the service-role client, where auth.uid() is NULL and is_admin()
-- would therefore be false.
-- =============================================================================

-- 1. Create Receipts Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false, -- private bucket
  10485760, -- 10 MB limit for a receipt image
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- 2. RLS Policies for Receipts Bucket

-- Brands can upload to their own folder: {brand_id}/filename
create policy "receipts_objects_insert_brand"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.current_user_role() = 'brand'
);

-- Brands can read their own receipts
create policy "receipts_objects_select_brand"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.current_user_role() = 'brand'
);

-- Admins can read all receipts
create policy "receipts_objects_select_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and public.is_admin()
);


-- 3. Escrow Confirmation RPC
-- Moves an escrow_hold transaction to 'confirmed', updates the order status,
-- logs the history, and credits the creator's pending wallet balance.
create or replace function public.confirm_escrow_payment(p_transaction_id uuid, p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx record;
  v_order record;
begin
  -- 0. Authorize the caller. Without this, any authenticated user could call
  --    this function directly through PostgREST and confirm their own payment.
  if current_user <> 'service_role' and not public.is_admin() then
    raise exception 'not authorized: admin only';
  end if;

  -- 1. Lock the transaction
  select * into v_tx from public.transactions
  where id = p_transaction_id for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  if v_tx.status <> 'pending' then
    raise exception 'Transaction is not pending';
  end if;

  if v_tx.type <> 'escrow_hold' then
    raise exception 'Transaction is not an escrow hold';
  end if;

  -- 2. Lock the order
  select * into v_order from public.orders
  where id = v_tx.order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'Order is not pending payment';
  end if;

  -- 3. Update Transaction
  update public.transactions
  set status = 'confirmed',
      confirmed_by = p_admin_id,
      confirmed_at = now()
  where id = p_transaction_id;

  -- 4. Update Order
  update public.orders
  set status = 'in_progress',
      updated_at = now()
  where id = v_order.id;

  -- 5. Insert Status History
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order.id, 'pending_payment', 'in_progress', p_admin_id, 'Escrow hold confirmed via manual payment proof');

  -- 6. Update Creator Wallet (upsert). creator_wallets is a denormalized
  --    balance and must move in lockstep with the confirmed transaction above
  --    — that's why both happen in this one function.
  insert into public.creator_wallets (creator_id, pending_balance_dzd, available_balance_dzd)
  values (v_order.creator_id, v_order.creator_payout_dzd, 0)
  on conflict (creator_id) do update
  set pending_balance_dzd = creator_wallets.pending_balance_dzd + excluded.pending_balance_dzd;

end;
$$;

-- Close the default PUBLIC execute grant; only the trusted backend may call it.
revoke all on function public.confirm_escrow_payment(uuid, uuid) from public;
revoke all on function public.confirm_escrow_payment(uuid, uuid) from anon;
revoke all on function public.confirm_escrow_payment(uuid, uuid) from authenticated;
grant execute on function public.confirm_escrow_payment(uuid, uuid) to service_role;
