import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role client. Bypasses Row Level Security entirely.
 *
 * Only call this from server code that has already verified the caller is
 * an authenticated admin (e.g. inside app/[locale]/(admin) route handlers
 * or server actions that check the caller's `public.users.role`), OR from
 * a narrow, pre-identified exception like `signup()` in `lib/auth/actions.ts`
 * inserting a brand-new user's own `public.users` row right after
 * `supabase.auth.signUp()` — that insert can't go through the RLS-scoped
 * client because email confirmation is required, so no session exists yet
 * in that request (`auth.uid()` is null; see `0002_rls_policies.sql`'s
 * `users_insert_self` policy comment, which anticipated exactly this). Safe
 * there specifically because the row's `id` comes from Supabase's own
 * trusted `signUp()` response, never from client input. Never import this
 * into a Client Component or anything that reaches the browser — the
 * `server-only` import will fail the build if that happens.
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
