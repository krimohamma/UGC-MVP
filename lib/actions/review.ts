"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewSchema } from "@/lib/validation/review";
import { notify } from "@/lib/notify";
import { revalidatePath } from "next/cache";

export async function submitReview(input: { orderId: string; rating: number; comment?: string }) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }
  const { orderId, rating, comment } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  // Direction/reviewee are derived from the ORDER's actual brand/creator, never
  // from client input — this must match reviews_insert_party_on_completed_order
  // (0002_rls_policies.sql) exactly, or the insert is correctly rejected by RLS.
  const { data: order } = await supabase
    .from("orders")
    .select("id, brand_id, creator_id, gig_id, status")
    .eq("id", orderId)
    .single();

  if (!order) return { success: false, error: "Order not found" };
  if (order.status !== "completed") {
    return { success: false, error: "Order is not completed" };
  }

  let direction: "brand_to_creator" | "creator_to_brand";
  let revieweeId: string;
  if (user.id === order.brand_id) {
    direction = "brand_to_creator";
    revieweeId = order.creator_id;
  } else if (user.id === order.creator_id) {
    direction = "creator_to_brand";
    revieweeId = order.brand_id;
  } else {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase.from("reviews").insert({
    order_id: orderId,
    direction,
    reviewer_id: user.id,
    reviewee_id: revieweeId,
    rating,
    comment: comment || null,
  });

  if (error) {
    // 23505 = unique_violation on (order_id, direction) -> already reviewed.
    return {
      success: false,
      error: error.code === "23505" ? "already_reviewed" : error.message,
    };
  }

  // Denormalized aggregates (see CLAUDE.md: "Anything that writes ... a
  // review ... must update the corresponding denormalized field(s)"). Only
  // brand_to_creator reviews have anywhere to aggregate to — brand_profiles
  // has no rating columns at all, so a creator_to_brand review is just
  // stored for the record. RLS only lets the reviewer's own client insert
  // the review row (which just happened, above); updating creator_profiles/
  // gigs — rows the REVIEWER doesn't own — needs the service-role client,
  // same pattern as reviewDelivery's transaction bookkeeping.
  if (direction === "brand_to_creator") {
    const admin = createAdminClient();

    const { data: creatorReviews } = await admin
      .from("reviews")
      .select("rating")
      .eq("reviewee_id", revieweeId)
      .eq("direction", "brand_to_creator");

    if (creatorReviews && creatorReviews.length > 0) {
      const avg = creatorReviews.reduce((sum, r) => sum + r.rating, 0) / creatorReviews.length;
      await admin
        .from("creator_profiles")
        .update({ rating_avg: Number(avg.toFixed(2)), rating_count: creatorReviews.length })
        .eq("user_id", revieweeId);
    }

    // Gig-level average: only reviews for orders placed against THIS gig.
    const { data: gigOrders } = await admin.from("orders").select("id").eq("gig_id", order.gig_id);
    const gigOrderIds = (gigOrders ?? []).map((o) => o.id);
    if (gigOrderIds.length > 0) {
      const { data: gigReviews } = await admin
        .from("reviews")
        .select("rating")
        .eq("direction", "brand_to_creator")
        .in("order_id", gigOrderIds);
      if (gigReviews && gigReviews.length > 0) {
        const avg = gigReviews.reduce((sum, r) => sum + r.rating, 0) / gigReviews.length;
        await admin.from("gigs").update({ avg_rating: Number(avg.toFixed(2)) }).eq("id", order.gig_id);
      }
    }
  }

  await notify({
    userId: revieweeId,
    type: "reviewReceived",
    bodyParams: { rating },
    linkUrl: `/dashboard/orders/${orderId}`,
  });

  revalidatePath(`/[locale]/dashboard/orders/${orderId}`, "page");
  revalidatePath("/[locale]/gigs", "layout");
  return { success: true };
}
