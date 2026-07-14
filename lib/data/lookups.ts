import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Niche = Database["public"]["Tables"]["niches"]["Row"];
export type Language = Database["public"]["Tables"]["languages"]["Row"];

/** Active niches, for browse filters and the gig/profile editors. */
export async function getNiches(): Promise<Niche[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("niches")
    .select("*")
    .eq("is_active", true)
    .order("slug");
  return data ?? [];
}

/** All content languages (`languages` table), for the gig language multi-select. */
export async function getLanguages(): Promise<Language[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("languages").select("*").order("code");
  return data ?? [];
}
