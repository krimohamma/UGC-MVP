import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/lib/database.types";

export type Gig = Database["public"]["Tables"]["gigs"]["Row"];
export type GigPackage = Database["public"]["Tables"]["gig_packages"]["Row"];

export interface GigFilterOptions {
  niche_id?: string;
  language_code?: string;
  min_price?: number;
  max_price?: number;
  max_delivery_days?: number;
}

export async function getGigs(filters: GigFilterOptions = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("gigs")
    .select(
      `
      *,
      users!inner (
        id,
        full_name,
        avatar_url
      ),
      niches (*),
      gig_languages (
        language_code,
        languages (*)
      ),
      gig_packages (*)
    `
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (filters.niche_id) {
    query = query.eq("niche_id", filters.niche_id);
  }

  if (filters.min_price) {
    query = query.gte("base_price_dzd", filters.min_price);
  }

  if (filters.max_price) {
    query = query.lte("base_price_dzd", filters.max_price);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching gigs:", error);
    return [];
  }

  let results = data ?? [];

  if (filters.language_code) {
    results = results.filter((gig) =>
      gig.gig_languages?.some(
        (gl: { language_code: string }) => gl.language_code === filters.language_code
      )
    );
  }

  if (filters.max_delivery_days) {
    const maxDays = filters.max_delivery_days;
    results = results.filter((gig) =>
      gig.gig_packages?.some(
        (pkg: { delivery_days: number }) => pkg.delivery_days <= maxDays
      )
    );
  }

  return results;
}

/** Active gigs for the homepage, highest-rated first. Used with ISR
 * (see the homepage's `revalidate` export) — deliberately uses the
 * cookie-free public client (not `lib/supabase/server.ts`) so this route
 * doesn't get forced into fully dynamic rendering; see lib/supabase/public.ts. */
export async function getFeaturedGigs(limit = 6) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("gigs")
    .select(
      `
      *,
      users!inner (
        id,
        full_name,
        avatar_url
      ),
      niches (*)
    `
    )
    .eq("status", "active")
    .order("avg_rating", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching featured gigs:", error);
    return [];
  }
  return data ?? [];
}

export async function getGigById(id: string) {
  const supabase = await createClient();
  const { data: gig, error } = await supabase
    .from("gigs")
    .select(
      `
      *,
      users!inner (
        id,
        full_name,
        avatar_url,
        creator_profiles (
          bio,
          rating_avg,
          rating_count,
          completed_orders_count,
          years_experience
        )
      ),
      niches (*),
      gig_languages (
        language_code,
        languages (*)
      ),
      gig_packages (*)
    `
    )
    .eq("id", id)
    .single();

  if (error || !gig) return null;

  // Fetch creator portfolio items for preview
  const { data: portfolio } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("creator_id", gig.creator_id)
    .order("sort_order", { ascending: true })
    .limit(6);

  return {
    ...gig,
    portfolio: portfolio ?? [],
  };
}

export async function getCreatorGigs(creatorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gigs")
    .select(
      `
      *,
      niches (*),
      gig_packages (*),
      gig_languages (language_code)
    `
    )
    .eq("creator_id", creatorId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching creator gigs:", error);
    return [];
  }
  return data ?? [];
}
