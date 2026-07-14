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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");
  const locale = localeFromNext(next);

  if (token_hash && type) {
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
