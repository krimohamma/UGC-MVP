"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyAdmins } from "@/lib/notify";
import { logMoneyEvent } from "@/lib/log";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: userRecord } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
  if (!userRecord || userRecord.role !== "admin") return null;

  return authData.user;
}

export async function confirmEscrowHold(transactionId: string) {
  const adminUser = await requireAdmin();
  if (!adminUser) return { success: false, error: "Forbidden: Admins only" };

  const adminClient = createAdminClient();

  const { error: rpcError } = await adminClient.rpc("confirm_escrow_payment", {
    p_transaction_id: transactionId,
    p_admin_id: adminUser.id,
  });

  if (rpcError) {
    logMoneyEvent({
      action: "confirmEscrowHold",
      outcome: "failure",
      transactionId,
      actorId: adminUser.id,
      error: rpcError.message,
    });
    return { success: false, error: rpcError.message };
  }

  const { data: tx } = await adminClient.from("transactions").select("order_id, amount_dzd").eq("id", transactionId).single();

  logMoneyEvent({
    action: "confirmEscrowHold",
    outcome: "success",
    transactionId,
    orderId: tx?.order_id ?? undefined,
    amountDzd: tx?.amount_dzd,
    actorId: adminUser.id,
  });

  if (tx?.order_id) {
    const { data: order } = await adminClient
      .from("orders")
      .select("brand_id, creator_id")
      .eq("id", tx.order_id)
      .single();
    if (order) {
      await Promise.all([
        notify({ userId: order.brand_id, type: "escrowConfirmed", linkUrl: `/dashboard/orders/${tx.order_id}` }),
        notify({ userId: order.creator_id, type: "escrowConfirmed", linkUrl: `/dashboard/orders/${tx.order_id}` }),
      ]);
    }
  }

  revalidatePath("/admin/transactions");

  return { success: true };
}

export async function confirmEscrowRelease(transactionId: string) {
  const adminUser = await requireAdmin();
  if (!adminUser) return { success: false, error: "Forbidden: Admins only" };

  const adminClient = createAdminClient();

  const { error: rpcError } = await adminClient.rpc("release_escrow_payment", {
    p_transaction_id: transactionId,
    p_admin_id: adminUser.id,
  });

  if (rpcError) {
    logMoneyEvent({
      action: "confirmEscrowRelease",
      outcome: "failure",
      transactionId,
      actorId: adminUser.id,
      error: rpcError.message,
    });
    return { success: false, error: rpcError.message };
  }

  const { data: tx } = await adminClient.from("transactions").select("order_id, amount_dzd").eq("id", transactionId).single();

  logMoneyEvent({
    action: "confirmEscrowRelease",
    outcome: "success",
    transactionId,
    orderId: tx?.order_id ?? undefined,
    amountDzd: tx?.amount_dzd,
    actorId: adminUser.id,
  });

  if (tx?.order_id) {
    const { data: order } = await adminClient.from("orders").select("creator_id").eq("id", tx.order_id).single();
    if (order) {
      await notify({ userId: order.creator_id, type: "escrowReleased", linkUrl: `/dashboard/orders/${tx.order_id}` });
    }
  }

  revalidatePath("/admin/releases");
  return { success: true };
}

export async function adminApproveDelivery(orderId: string) {
  const adminUser = await requireAdmin();
  if (!adminUser) return { success: false, error: "Forbidden: Admins only" };

  const adminClient = createAdminClient();

  // Update order status to delivered
  const { error: updateError } = await adminClient
    .from("orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending_admin_review"); // Ensure it's in the right state

  if (updateError) return { success: false, error: "Failed to approve delivery" };

  await adminClient.from("order_status_history").insert({
    order_id: orderId,
    from_status: "pending_admin_review",
    to_status: "delivered",
    changed_by: adminUser.id,
    note: "Admin approved delivery quality",
  });

  const { data: order } = await adminClient.from("orders").select("brand_id").eq("id", orderId).single();
  if (order) {
    await notify({ userId: order.brand_id, type: "deliveryApproved", linkUrl: `/dashboard/orders/${orderId}` });
  }

  revalidatePath("/admin/deliveries");
  return { success: true };
}

export async function adminRejectDelivery(orderId: string, note: string) {
  const adminUser = await requireAdmin();
  if (!adminUser) return { success: false, error: "Forbidden: Admins only" };

  if (!note || note.trim() === "") return { success: false, error: "Rejection reason is required" };

  const adminClient = createAdminClient();

  // We could send it back to 'in_progress' or 'revision_requested'.
  // Let's use 'revision_requested' so the creator knows there's feedback.
  const { error: updateError } = await adminClient
    .from("orders")
    .update({ status: "revision_requested", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending_admin_review");

  if (updateError) return { success: false, error: "Failed to reject delivery" };

  await adminClient.from("order_status_history").insert({
    order_id: orderId,
    from_status: "pending_admin_review",
    to_status: "revision_requested",
    changed_by: adminUser.id,
    note: `Admin rejected delivery: ${note}`,
  });

  const { data: order } = await adminClient.from("orders").select("creator_id").eq("id", orderId).single();
  if (order) {
    await notify({ userId: order.creator_id, type: "deliveryRejected", linkUrl: `/dashboard/orders/${orderId}` });
  }

  revalidatePath("/admin/deliveries");
  return { success: true };
}

/**
 * Process a creator's payout request (distinct from confirmEscrowRelease —
 * that moves funds from pending to available in the wallet; this pays out
 * the creator's actual withdrawal request to their CCP/BaridiMob account).
 * No RPC involved: payouts is a plain table with its own RLS
 * (payouts_update_admin), but the wallet deduction needs the service-role
 * client since creator_wallets has no authenticated-role write policy at
 * all (see 0002_rls_policies.sql — balances only move via trusted backend
 * code).
 */
export async function processPayout(payoutId: string, action: "paid" | "rejected") {
  const adminUser = await requireAdmin();
  if (!adminUser) return { success: false, error: "Forbidden: Admins only" };

  const adminClient = createAdminClient();

  const { data: payout } = await adminClient
    .from("payouts")
    .select("id, creator_id, amount_dzd, status")
    .eq("id", payoutId)
    .single();

  if (!payout) {
    logMoneyEvent({ action: "processPayout", outcome: "failure", payoutId, actorId: adminUser.id, error: "Payout not found" });
    return { success: false, error: "Payout not found" };
  }
  if (payout.status !== "pending") {
    logMoneyEvent({
      action: "processPayout",
      outcome: "failure",
      payoutId,
      actorId: adminUser.id,
      error: `Payout is not pending (status=${payout.status})`,
    });
    return { success: false, error: "Payout is not pending" };
  }

  const { error: updateError } = await adminClient
    .from("payouts")
    .update({
      status: action,
      processed_by: adminUser.id,
      processed_at: new Date().toISOString(),
    })
    .eq("id", payoutId);

  if (updateError) {
    logMoneyEvent({
      action: "processPayout",
      outcome: "failure",
      payoutId,
      amountDzd: payout.amount_dzd,
      actorId: adminUser.id,
      error: updateError.message,
    });
    return { success: false, error: updateError.message };
  }

  if (action === "paid") {
    const { data: wallet } = await adminClient
      .from("creator_wallets")
      .select("available_balance_dzd")
      .eq("creator_id", payout.creator_id)
      .single();

    await adminClient
      .from("creator_wallets")
      .update({
        available_balance_dzd: Math.max((wallet?.available_balance_dzd ?? 0) - payout.amount_dzd, 0),
      })
      .eq("creator_id", payout.creator_id);
  }

  logMoneyEvent({
    action: "processPayout",
    outcome: "success",
    payoutId,
    amountDzd: payout.amount_dzd,
    actorId: adminUser.id,
    error: action === "rejected" ? "processed as rejected" : undefined,
  });

  await notify({
    userId: payout.creator_id,
    type: "payoutProcessed",
    bodyParams: { amount: payout.amount_dzd },
    linkUrl: "/dashboard",
  });

  revalidatePath("/admin/payouts");
  revalidatePath("/[locale]/dashboard", "layout");
  return { success: true };
}

/** Basic moderation: activate/deactivate a gig. Plain RLS-permitted update
 * (gigs_update_own_or_admin already allows admin via their own session) —
 * no service-role client needed here. */
export async function adminSetGigStatus(gigId: string, status: "active" | "paused") {
  const adminUser = await requireAdmin();
  if (!adminUser) return { success: false, error: "Forbidden: Admins only" };

  const supabase = await createClient();
  const { error } = await supabase.from("gigs").update({ status }).eq("id", gigId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/gigs");
  revalidatePath("/[locale]/gigs", "layout");
  return { success: true };
}
