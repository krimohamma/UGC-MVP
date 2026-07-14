import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Review = Database["public"]["Tables"]["reviews"]["Row"];

/** Both possible reviews (brand_to_creator, creator_to_brand) for an order. */
export async function getOrderReviews(orderId: string): Promise<Review[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("reviews").select("*").eq("order_id", orderId);
  return data ?? [];
}
