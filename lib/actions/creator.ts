"use me-server";
"use server";

import { createClient } from "@/lib/supabase/server";
import {
  creatorProfileSchema,
  payoutAccountSchema,
  type CreatorProfileInput,
  type PayoutAccountInput,
} from "@/lib/validation/profile";
import {
  portfolioItemSchema,
  type PortfolioItemInput,
} from "@/lib/validation/portfolio";
import { payoutRequestSchema, type PayoutRequestInput } from "@/lib/validation/payout-request";
import { logMoneyEvent } from "@/lib/log";
import { revalidatePath } from "next/cache";

export async function updateCreatorProfile(input: CreatorProfileInput) {
  const parsed = creatorProfileSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase.from("creator_profiles").upsert(
    {
      user_id: user.id,
      bio: parsed.bio || null,
      niche_id: parsed.niche_id,
      years_experience: parsed.years_experience ?? null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Failed to update creator profile:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/[locale]/dashboard", "layout");
  return { success: true };
}

export async function savePayoutAccount(input: PayoutAccountInput) {
  const parsed = payoutAccountSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Set existing accounts for this creator to not default
  await supabase
    .from("creator_payout_accounts")
    .update({ is_default: false })
    .eq("creator_id", user.id);

  const { error } = await supabase.from("creator_payout_accounts").insert({
    creator_id: user.id,
    method: parsed.method,
    account_holder_name: parsed.account_holder_name,
    account_number: parsed.account_number,
    is_default: true,
  });

  if (error) {
    console.error("Failed to save payout account:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/[locale]/dashboard", "layout");
  return { success: true };
}

export async function addPortfolioItem(input: PortfolioItemInput) {
  const parsed = portfolioItemSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Get max sort_order
  const { data: existing } = await supabase
    .from("portfolio_items")
    .select("sort_order")
    .eq("creator_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("portfolio_items").insert({
    creator_id: user.id,
    title: parsed.title || null,
    video_url: parsed.video_url || null,
    thumbnail_url: parsed.thumbnail_url || null,
    external_url: parsed.external_url || null,
    sort_order: nextSortOrder,
  });

  if (error) {
    console.error("Failed to add portfolio item:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/[locale]/dashboard", "layout");
  return { success: true };
}

export async function deletePortfolioItem(itemId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("portfolio_items")
    .delete()
    .eq("id", itemId)
    .eq("creator_id", user.id);

  if (error) {
    console.error("Failed to delete portfolio item:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/[locale]/dashboard", "layout");
  return { success: true };
}

export async function requestPayout(input: PayoutRequestInput) {
  const parsed = payoutRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "invalidAmount" };
  }
  const { amount_dzd, payout_account_id } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  // available_balance_dzd is the actual withdrawable amount (see CLAUDE.md:
  // creator_wallets tracks pending vs. available separately) — RLS on
  // `payouts` doesn't and can't check this against the wallet, so it's
  // enforced here before the insert.
  const { data: wallet } = await supabase
    .from("creator_wallets")
    .select("available_balance_dzd")
    .eq("creator_id", user.id)
    .maybeSingle();

  const available = wallet?.available_balance_dzd ?? 0;
  if (amount_dzd > available) {
    logMoneyEvent({
      action: "requestPayout",
      outcome: "failure",
      amountDzd: amount_dzd,
      actorId: user.id,
      error: `insufficientBalance (available=${available})`,
    });
    return { success: false, error: "insufficientBalance" };
  }

  const { data: payout, error } = await supabase
    .from("payouts")
    .insert({
      creator_id: user.id,
      payout_account_id,
      amount_dzd,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    logMoneyEvent({
      action: "requestPayout",
      outcome: "failure",
      amountDzd: amount_dzd,
      actorId: user.id,
      error: error.message,
    });
    return { success: false, error: error.message };
  }

  logMoneyEvent({
    action: "requestPayout",
    outcome: "success",
    payoutId: payout.id,
    amountDzd: amount_dzd,
    actorId: user.id,
  });

  revalidatePath("/[locale]/dashboard", "layout");
  return { success: true };
}

export async function reorderPortfolioItems(items: { id: string; sort_order: number }[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  for (const item of items) {
    await supabase
      .from("portfolio_items")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id)
      .eq("creator_id", user.id);
  }

  revalidatePath("/[locale]/dashboard", "layout");
  return { success: true };
}
