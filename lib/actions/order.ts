"use server";

import { createClient } from "@/lib/supabase/server";
import { createOrderSchema, submitPaymentSchema } from "@/lib/validation/order";
import { revalidatePath } from "next/cache";
import { logMoneyEvent } from "@/lib/log";

export async function createOrder(formData: FormData) {
  const supabase = await createClient();
  
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { success: false, error: "Unauthorized" };
  }
  
  const parsed = createOrderSchema.safeParse({
    gigId: formData.get("gigId"),
    packageId: formData.get("packageId"),
    requirements: formData.get("requirements") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: "Invalid data" };
  }

  const { gigId, packageId, requirements } = parsed.data;

  // 1. Fetch gig and package details
  const { data: gigPackage, error: pkgError } = await supabase
    .from("gig_packages")
    .select("*, gigs(creator_id)")
    .eq("id", packageId)
    .single();

  if (pkgError || !gigPackage) {
    return { success: false, error: "Package not found" };
  }

  if (gigPackage.gig_id !== gigId) {
    return { success: false, error: "Package does not belong to this gig" };
  }

  const priceDzd = gigPackage.price_dzd;
  let commissionAmountDzd = 0;
  let commissionRate = 0;

  // Commission Logic:
  // If price_dzd < 10000: Flat fee 1000 DZD
  // If price_dzd >= 10000: 10%
  if (priceDzd < 10000) {
    commissionAmountDzd = 1000;
    commissionRate = 1000 / priceDzd; 
  } else {
    commissionRate = 0.10;
    // Enforce Math.round to avoid float constraints
    commissionAmountDzd = Math.round(priceDzd * 0.10);
  }

  // Ensure commission doesn't exceed price (sanity check)
  if (commissionAmountDzd > priceDzd) {
    commissionAmountDzd = priceDzd;
  }

  const creatorPayoutDzd = priceDzd - commissionAmountDzd;

  // 2. Insert order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      brand_id: authData.user.id,
      creator_id: gigPackage.gigs!.creator_id,
      gig_id: gigId,
      gig_package_id: packageId,
      price_dzd: priceDzd,
      commission_rate: commissionRate,
      commission_amount_dzd: commissionAmountDzd,
      creator_payout_dzd: creatorPayoutDzd,
      revisions_included: gigPackage.revisions_included,
      requirements: requirements || null,
      status: "pending_payment",
    })
    .select("id")
    .single();

  if (orderError) {
    logMoneyEvent({
      action: "createOrder",
      outcome: "failure",
      actorId: authData.user.id,
      amountDzd: priceDzd,
      error: orderError.message,
    });
    return { success: false, error: orderError.message };
  }

  // Also log the order creation
  await supabase.from("order_status_history").insert({
    order_id: order.id,
    to_status: "pending_payment",
    changed_by: authData.user.id,
    note: "Order created",
  });

  logMoneyEvent({
    action: "createOrder",
    outcome: "success",
    orderId: order.id,
    amountDzd: priceDzd,
    actorId: authData.user.id,
  });

  return { success: true, orderId: order.id };
}

export async function submitPaymentProof(formData: FormData) {
  const supabase = await createClient();
  
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = submitPaymentSchema.safeParse({
    orderId: formData.get("orderId"),
    paymentMethod: formData.get("paymentMethod"),
    referenceNumber: formData.get("referenceNumber") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: "Invalid data" };
  }

  const { orderId, paymentMethod, referenceNumber } = parsed.data;
  const proofFile = formData.get("proofFile") as File | null;

  if (!proofFile || proofFile.size === 0) {
    return { success: false, error: "Payment proof receipt is required" };
  }

  // Fetch order to verify ownership
  const { data: order, error: orderCheckErr } = await supabase
    .from("orders")
    .select("brand_id, price_dzd, status")
    .eq("id", orderId)
    .single();

  if (orderCheckErr || !order) {
    return { success: false, error: "Order not found" };
  }
  if (order.brand_id !== authData.user.id) {
    return { success: false, error: "Unauthorized order" };
  }
  if (order.status !== "pending_payment") {
    return { success: false, error: "Order is not pending payment" };
  }

  // Upload proof to receipts bucket
  const fileExt = proofFile.name.split(".").pop();
  const fileName = `${authData.user.id}/receipt_${orderId}_${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(fileName, proofFile);

  if (uploadError) {
    logMoneyEvent({
      action: "submitPaymentProof",
      outcome: "failure",
      orderId,
      actorId: authData.user.id,
      error: `receipt upload: ${uploadError.message}`,
    });
    return { success: false, error: "Failed to upload receipt: " + uploadError.message };
  }

  // Insert transaction
  const { error: txError } = await supabase.from("transactions").insert({
    order_id: orderId,
    type: "escrow_hold",
    amount_dzd: order.price_dzd,
    status: "pending",
    payment_method: paymentMethod,
    reference_number: referenceNumber || null,
    proof_image_url: fileName,
  });

  if (txError) {
    logMoneyEvent({
      action: "submitPaymentProof",
      outcome: "failure",
      orderId,
      amountDzd: order.price_dzd,
      actorId: authData.user.id,
      error: txError.message,
    });
    return { success: false, error: txError.message };
  }

  logMoneyEvent({
    action: "submitPaymentProof",
    outcome: "success",
    orderId,
    amountDzd: order.price_dzd,
    actorId: authData.user.id,
  });

  return { success: true };
}
