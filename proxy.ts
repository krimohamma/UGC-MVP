import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  // Run locale routing first so we have a response object (with any locale
  // redirect/rewrite already applied) to attach refreshed auth cookies to.
  const response = intlMiddleware(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touching getUser() refreshes the session token if it's expired and
  // writes the new cookies onto `response` via setAll above.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // `auth` is excluded because Supabase email links must hit a stable,
  // non-locale-prefixed URL (app/auth/confirm/route.ts).
  matcher: ["/((?!api|trpc|_next|_vercel|auth|.*\\..*).*)"],
};
