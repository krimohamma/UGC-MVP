-- =============================================================================
-- Migration 0009: Fix the caller-identity guard in both escrow RPCs.
--
-- Found by scripts/verify-lifecycle.ts: `confirm_escrow_payment` and
-- `release_escrow_payment` (0005/0007) guarded themselves with
-- `current_user = 'service_role'`, but that ALWAYS evaluates false —
-- inside a SECURITY DEFINER function, `current_user` reflects the
-- function's *owner* (here, `postgres`), not the caller. This is a
-- well-known Postgres gotcha and is exactly why lib/actions/admin.ts's
-- legitimate service-role calls were being rejected with "not authorized:
-- admin only": the guard was unconditionally hostile to everyone,
-- including the one caller it was meant to allow.
--
-- Empirically confirmed (see chat log) that `current_setting('role', true)`
-- DOES correctly report the PostgREST-assigned role ('service_role',
-- 'authenticated', etc.) even inside a SECURITY DEFINER function, because
-- it's a GUC that PostgREST sets via `SET ROLE`/`SET LOCAL ROLE` -- a
-- different mechanism from the authorization-ID swap that SECURITY DEFINER
-- performs, and one that plain GUC lookups aren't affected by. Confirmed
-- for both the legacy JWT-based service_role and the new `sb_secret_...`
-- key format (both populate `request.jwt.claims.role` = 'service_role' and
-- the `role` GUC = 'service_role' identically).
--
-- Note the EXECUTE grant itself (service_role only, revoked from
-- public/anon/authenticated) was never the broken part -- that's already
-- verified end-to-end (42501 for any non-service_role caller). This
-- migration only fixes the redundant in-function guard so the one caller
-- it's supposed to allow can actually get through.
-- =============================================================================

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
  if coalesce(current_setting('role', true), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not authorized: admin only';
  end if;

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

  select * into v_order from public.orders
  where id = v_tx.order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'Order is not pending payment';
  end if;

  update public.transactions
  set status = 'confirmed',
      confirmed_by = p_admin_id,
      confirmed_at = now()
  where id = p_transaction_id;

  update public.orders
  set status = 'in_progress',
      updated_at = now()
  where id = v_order.id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order.id, 'pending_payment', 'in_progress', p_admin_id, 'Escrow hold confirmed via manual payment proof');

  insert into public.creator_wallets (creator_id, pending_balance_dzd, available_balance_dzd)
  values (v_order.creator_id, v_order.creator_payout_dzd, 0)
  on conflict (creator_id) do update
  set pending_balance_dzd = creator_wallets.pending_balance_dzd + excluded.pending_balance_dzd;

end;
$$;

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
  if coalesce(current_setting('role', true), '') <> 'service_role' and not public.is_admin() then
    raise exception 'not authorized: admin only';
  end if;

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

  select * into v_order from public.orders
  where id = v_tx.order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status <> 'completed' then
    raise exception 'Order is not completed';
  end if;

  update public.transactions
  set status = 'confirmed',
      confirmed_by = p_admin_id,
      confirmed_at = now()
  where id = p_transaction_id;

  insert into public.creator_wallets (creator_id, pending_balance_dzd, available_balance_dzd)
  values (v_order.creator_id, 0, v_order.creator_payout_dzd)
  on conflict (creator_id) do update
  set pending_balance_dzd = greatest(creator_wallets.pending_balance_dzd - v_order.creator_payout_dzd, 0),
      available_balance_dzd = creator_wallets.available_balance_dzd + v_order.creator_payout_dzd;

end;
$$;
