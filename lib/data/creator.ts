import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type CreatorProfile = Database["public"]["Tables"]["creator_profiles"]["Row"];
export type PortfolioItem = Database["public"]["Tables"]["portfolio_items"]["Row"];
export type PayoutAccount = Database["public"]["Tables"]["creator_payout_accounts"]["Row"];

export async function getCreatorProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creator_profiles")
    .select("*, users!inner(full_name, avatar_url, email), niches(*)")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getCreatorPayoutAccount(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creator_payout_accounts")
    .select("*")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getCreatorPortfolio(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("creator_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCreatorWallet(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creator_wallets")
    .select("*")
    .eq("creator_id", userId)
    .maybeSingle();
  // No row yet means the creator has never had a confirmed transaction —
  // that's a real zero balance, not missing data.
  return data ?? { creator_id: userId, available_balance_dzd: 0, pending_balance_dzd: 0, updated_at: null };
}

export async function getCreatorPayouts(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payouts")
    .select("*, creator_payout_accounts(method, account_number)")
    .eq("creator_id", userId)
    .order("requested_at", { ascending: false });
  return data ?? [];
}
