-- =============================================================================
-- Migration 0007: Fulfillment objects — deliverables bucket + escrow release.
--
-- Split out of 0006 because these reference the 'pending_admin_review' enum
-- value that 0006 adds; Postgres requires that to be committed first.
--
-- SECURITY NOTE: `release_escrow_payment` moves money, same reasoning as
-- `confirm_escrow_payment` in 0005 — SECURITY DEFINER, so EXECUTE is revoked
-- from public/anon/authenticated and granted only to service_role, with an
-- in-function caller guard as defense in depth.
-- =============================================================================

-- 1. Create Deliverables Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deliverables',
  'deliverables',
  false, -- private bucket
  524288000, -- 500 MB limit for final videos
  array['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm', 'application/zip']
)
on conflict (id) do nothing;

-- 2. RLS Policies for Deliverables Bucket
-- Objects live at {order_id}/{filename}.

-- Creators can upload to their own order folder
create policy "deliverables_objects_insert_creator"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'deliverables'
  and public.current_user_role() = 'creator'
  and exists (
    select 1 from public.orders o
    where o.id::text = (storage.foldername(name))[1]
      and o.creator_id = (select auth.uid())
  )
);

-- Brands can read from their order folder, but NOT while the delivery is still
-- in admin QC — that's the point of pending_admin_review.
create policy "deliverables_objects_select_brand"
on storage.objects for select
to authenticated
using (
  bucket_id = 'deliverables'
  and public.current_user_role() = 'brand'
  and exists (
    select 1 from public.orders o
    where o.id::text = (storage.foldername(name))[1]
      and o.brand_id = (select auth.uid())
      and o.status <> 'pending_admin_review'
  )
);

-- Creators can read from their own order folder
create policy "deliverables_objects_select_creator"
on storage.objects for select
to authenticated
using (
  bucket_id = 'deliverables'
  and public.current_user_role() = 'creator'
  and exists (
    select 1 from public.orders o
    where o.id::text = (storage.foldername(name))[1]
      and o.creator_id = (select auth.uid())
  )
);

-- Admins can read all deliverables (needed for QC)
create policy "deliverables_objects_select_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'deliverables'
  and public.is_admin()
);


-- 3. Escrow Release RPC
-- Moves an escrow_release transaction to 'confirmed' and moves the creator's
-- payout from pending to available.
create or replace function public.release_escrow_payment(p_transaction_id uuid, p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx record;
  v_order record;
begin
  -- 0. Authorize the caller (see 0005 for the full reasoning).
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

  if v_tx.type <> 'escrow_release' then
    raise exception 'Transaction is not an escrow release';
  end if;

  -- 2. Lock the order
  select * into v_order from public.orders
  where id = v_tx.order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status <> 'completed' then
    raise exception 'Order is not completed';
  end if;

  -- 3. Update Transaction
  update public.transactions
  set status = 'confirmed',
      confirmed_by = p_admin_id,
      confirmed_at = now()
  where id = p_transaction_id;

  -- 4. Move the payout from pending to available on the creator's wallet.
  insert into public.creator_wallets (creator_id, pending_balance_dzd, available_balance_dzd)
  values (v_order.creator_id, 0, v_order.creator_payout_dzd)
  on conflict (creator_id) do update
  set pending_balance_dzd = greatest(creator_wallets.pending_balance_dzd - v_order.creator_payout_dzd, 0),
      available_balance_dzd = creator_wallets.available_balance_dzd + v_order.creator_payout_dzd;

end;
$$;

revoke all on function public.release_escrow_payment(uuid, uuid) from public;
revoke all on function public.release_escrow_payment(uuid, uuid) from anon;
revoke all on function public.release_escrow_payment(uuid, uuid) from authenticated;
grant execute on function public.release_escrow_payment(uuid, uuid) to service_role;
