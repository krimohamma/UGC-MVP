import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role client. Bypasses Row Level Security entirely.
 *
 * Only call this from server code that has already verified the caller is
 * an authenticated admin (e.g. inside app/[locale]/(admin) route handlers
 * or server actions that check the caller's `public.users.role`). Never
 * import this into a Client Component or anything that reaches the browser
 * — the `server-only` import will fail the build if that happens.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
