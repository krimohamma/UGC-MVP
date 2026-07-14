import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAuthEvent } from "@/lib/log";

// Not under app/[locale] on purpose, same reasoning as the route this
// replaces: Supabase's email templates embed a single, fixed link (no
// locale variable), so this route has to live at a stable path. See
// CLAUDE.md's Auth section for the required Supabase dashboard template
// edits that point signup/recovery emails here.
//
// Uses the token_hash + verifyOtp pattern instead of exchangeCodeForSession:
// verifyOtp redeems the one-time token embedded in the URL directly against
// Supabase's Auth API and needs nothing from the browser that requested the
// email — unlike the PKCE code-exchange flow this replaces, which required a
// code_verifier cookie set on the *requesting* browser, and so silently
// failed (auth_callback_failed) whenever a password-reset link was opened on
// a different device/browser than the one that asked for it. That's the
// normal case for password reset, not an edge case, which is why this
// pattern is what Supabase's own current docs recommend for server-rendered
// apps (verified via the Supabase MCP connector's search_docs before writing
// this, not from memory).
function localeFromNext(next: string | null): "fr" | "ar" {
  return next?.startsWith("/ar") ? "ar" : "fr";
}

// {{ .RedirectTo }} (what populates `next` in the email template) is
// whatever was passed to resetPasswordForEmail's `redirectTo` / signUp's
// `emailRedirectTo` — in this app that's always an absolute URL built from
// the request's own origin (see lib/auth/actions.ts), e.g.
// "https://ugc-mvp-two.vercel.app/fr/reset-password", not a bare path. But
// `next` is attacker-controllable in principle (anyone can craft their own
// /auth/confirm?...&next=https://evil.example link that *looks* like a
// legitimate confirmation link), so it must be validated before use as a
// redirect target: an open redirect would let a crafted link bounce a user
// straight to a phishing domain right after a real, successful verifyOtp.
// Only accept a same-origin absolute URL (reduced to its path) or a plain
// path starting with "/"; anything else falls back to the homepage.
function sanitizeNext(next: string | null, origin: string): string | null {
  if (!next) return null;
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  try {
    const url = new URL(next);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next");
  const next = sanitizeNext(rawNext, origin);
  const locale = localeFromNext(next);

  if (token_hash && type) {
    // token_hash may arrive prefixed "pkce_" (seen in real production links,
    // since resetPasswordForEmail is PKCE-flow-eligible per Supabase's docs
    // — "Which authentication flows have PKCE support? ... Password
    // Recovery"). Pass it through unchanged: every documented verifyOtp
    // usage (the reference page's "Verify Email Auth (Token Hash)" example,
    // and the email-templates guide's server-side-endpoint example) treats
    // token_hash as an opaque string with no client-side parsing or prefix
    // handling — verified via the Supabase MCP connector's search_docs
    // before writing this, not assumed. Stripping/transforming it would be
    // guessing at an internal GoTrue format with no documented basis.
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      logAuthEvent({ action: "confirmEmailLink", outcome: "success", otpType: type, next: next ?? undefined });
      return NextResponse.redirect(`${origin}${next ?? `/${locale}/dashboard`}`);
    }

    logAuthEvent({
      action: "confirmEmailLink",
      outcome: "failure",
      otpType: type,
      next: next ?? undefined,
      error: error.message,
      errorCode: error.code,
    });
  } else {
    logAuthEvent({
      action: "confirmEmailLink",
      outcome: "failure",
      otpType: type ?? undefined,
      next: next ?? undefined,
      error: "missing token_hash or type",
    });
  }

  // Send the user somewhere that can actually do something about it: a
  // recovery link failure should offer "request a new one" (forgot-password),
  // a signup confirmation failure should offer "sign up again" (signup) —
  // a bare login error is a dead end for either case.
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/${locale}/forgot-password?error=linkExpired`);
  }
  if (type === "email" || type === "signup") {
    return NextResponse.redirect(`${origin}/${locale}/signup?error=confirmationExpired`);
  }
  return NextResponse.redirect(`${origin}/${locale}/login?error=auth_confirm_failed`);
}
