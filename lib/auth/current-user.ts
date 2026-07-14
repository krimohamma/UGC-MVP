import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

/**
 * Fetch the signed-in user's `public.users` row (role, full_name, locale, …),
 * or null if not signed in. Server-only; subject to RLS (a user can always
 * read their own row per 0002_rls_policies.sql).
 */
export async function getCurrentUser(): Promise<UserRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return data ?? null;
}
