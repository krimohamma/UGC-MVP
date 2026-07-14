import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Anonymous, cookie-free Supabase client for genuinely public reads on
 * statically-rendered/ISR pages (e.g. the homepage's featured gigs).
 *
 * `lib/supabase/server.ts`'s client calls `cookies()` internally (needed to
 * read the signed-in user's session) — and Next.js treats ANY use of
 * `cookies()`/`headers()` in a route's render path as request-specific,
 * which silently disables static generation / `revalidate` for that whole
 * route, even if the actual query never needed a session. Since this client
 * never touches cookies at all, pages that only use it for public,
 * RLS-permitted-for-`anon` data can stay static + revalidate.
 *
 * Still fully subject to RLS as the `anon` role — this is NOT a way to
 * bypass security, just to avoid dragging in the session-cookie machinery
 * for reads that never needed a session in the first place.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
