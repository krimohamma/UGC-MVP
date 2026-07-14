"use server";

import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { deliverOrderSchema, reviewDeliverySchema, DeliverOrderData, ReviewDeliveryData } from "../validation/fulfillment";
import { notify, notifyAdmins } from "../notify";
import { logMoneyEvent } from "../log";
import { revalidatePath } from "next/cache";

export async function deliverOrder(data: DeliverOrderData) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: "Non autorisé" };
  }

  const parsed = deliverOrderSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Données invalides", issues: parsed.error.issues };
  }

  const { orderId, fileUrl, fileType, note } = parsed.data;

  // Verify order ownership and status
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, creator_id, status, revisions_used")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return { error: "Commande introuvable" };
  }

  if (order.creator_id !== authData.user.id) {
    return { error: "Non autorisé" };
  }

  if (order.status !== "in_progress" && order.status !== "revision_requested") {
    return { error: "La commande n'est pas en cours de traitement" };
  }

  // 1. Update order status to pending_admin_review
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "pending_admin_review", updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (updateError) {
    return { error: "Erreur lors de la mise à jour de la commande" };
  }

  // 2. Log status history
  await supabase.from("order_status_history").insert({
    order_id: orderId,
    from_status: order.status,
    to_status: "pending_admin_review",
    changed_by: authData.user.id,
    note: note || "Work submitted for admin review",
  });

  // 3. Insert deliverable
  const { error: deliverableError } = await supabase.from("order_deliverables").insert({
    order_id: orderId,
    uploaded_by: authData.user.id,
    file_url: fileUrl,
    file_type: fileType,
    revision_round: order.revisions_used,
    note: note || null,
  });

  if (deliverableError) {
    // We already updated the order, but inserting the deliverable failed
    return { error: "Erreur lors de l'enregistrement du livrable" };
  }

  await notifyAdmins({ type: "deliverySubmitted", linkUrl: "/admin/deliveries" });

  revalidatePath(`/dashboard/orders/${orderId}`);
  return { success: true };
}

export async function reviewDelivery(data: ReviewDeliveryData) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: "Non autorisé" };
  }

  const parsed = reviewDeliverySchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Données invalides", issues: parsed.error.issues };
  }

  const { orderId, action, note } = parsed.data;

  // Verify order ownership and status
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, brand_id, creator_id, status, revisions_used, revisions_included, creator_payout_dzd, commission_amount_dzd")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return { error: "Commande introuvable" };
  }

  if (order.brand_id !== authData.user.id) {
    return { error: "Non autorisé" };
  }

  if (order.status !== "delivered") {
    return { error: "La commande n'est pas au statut 'livré'" };
  }

  if (action === "accept") {
    const { error: updateError } = await supabase
      .from("orders")
      .update({ 
        status: "completed", 
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq("id", orderId);

    if (updateError) return { error: "Erreur lors de l'acceptation de la commande" };

    await supabase.from("order_status_history").insert({
      order_id: orderId,
      from_status: order.status,
      to_status: "completed",
      changed_by: authData.user.id,
      note: "Brand accepted the delivery",
    });

    // Money-ledger rows: RLS only lets a brand insert 'escrow_hold' rows (see
    // 0002_rls_policies.sql), so this bookkeeping — already gated by the
    // ownership/status checks above — goes through the service-role client,
    // same as lib/actions/admin.ts. Two rows: a pending escrow_release (an
    // admin must still confirm the actual transfer via release_escrow_payment)
    // and a confirmed commission row (the platform's cut isn't a bank
    // transfer needing manual confirmation — it's already reflected in
    // creator_payout_dzd < price_dzd — so it's booked immediately).
    const adminClient = createAdminClient();
    const { error: releaseTxError } = await adminClient.from("transactions").insert({
      order_id: orderId,
      type: "escrow_release",
      amount_dzd: order.creator_payout_dzd,
      status: "pending",
    });
    if (releaseTxError) {
      logMoneyEvent({
        action: "acceptDelivery",
        outcome: "failure",
        orderId,
        amountDzd: order.creator_payout_dzd,
        actorId: authData.user.id,
        error: `escrow_release insert: ${releaseTxError.message}`,
      });
      return { error: "Erreur lors de la création de la transaction de paiement" };
    }

    const { error: commissionTxError } = await adminClient.from("transactions").insert({
      order_id: orderId,
      type: "commission",
      amount_dzd: order.commission_amount_dzd,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    });
    if (commissionTxError) {
      logMoneyEvent({
        action: "acceptDelivery",
        outcome: "failure",
        orderId,
        amountDzd: order.commission_amount_dzd,
        actorId: authData.user.id,
        error: `commission insert: ${commissionTxError.message}`,
      });
      return { error: "Erreur lors de l'enregistrement de la commission" };
    }

    logMoneyEvent({
      action: "acceptDelivery",
      outcome: "success",
      orderId,
      amountDzd: order.creator_payout_dzd,
      actorId: authData.user.id,
    });

    await notify({ userId: order.creator_id, type: "orderCompleted", linkUrl: `/dashboard/orders/${orderId}` });

  } else if (action === "revise") {
    if (order.revisions_used >= order.revisions_included) {
      return { error: "Limite de révisions atteinte" };
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ 
        status: "revision_requested",
        revisions_used: order.revisions_used + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (updateError) return { error: "Erreur lors de la demande de révision" };

    await supabase.from("order_status_history").insert({
      order_id: orderId,
      from_status: order.status,
      to_status: "revision_requested",
      changed_by: authData.user.id,
      note: note || "Brand requested a revision",
    });

    // Same notification as an admin-initiated QC rejection (see
    // adminRejectDelivery) — from the creator's side, both mean "redeliver".
    await notify({ userId: order.creator_id, type: "deliveryRejected", linkUrl: `/dashboard/orders/${orderId}` });

  } else if (action === "dispute") {
    const { error: updateError } = await supabase
      .from("orders")
      .update({ 
        status: "disputed",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (updateError) return { error: "Erreur lors de l'ouverture du litige" };

    await supabase.from("order_status_history").insert({
      order_id: orderId,
      from_status: order.status,
      to_status: "disputed",
      changed_by: authData.user.id,
      note: note || "Brand opened a dispute",
    });

    await supabase.from("disputes").insert({
      order_id: orderId,
      raised_by: authData.user.id,
      reason: note || "Dispute opened by brand",
      status: "open",
    });

    await notifyAdmins({ type: "disputeOpened", linkUrl: `/dashboard/orders/${orderId}` });
  }

  revalidatePath(`/dashboard/orders/${orderId}`);
  return { success: true };
}
