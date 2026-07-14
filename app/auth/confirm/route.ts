import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { logAuthEvent } from "@/lib/log";

// Not under app/[locale] on purpose, same reasoning as the route this
// replaces: Supabase's email templates embed a single, fixed link (no
// locale variable), so this route has to live at a stable path. See
// CLAUDE.md's Auth section for the required Supabase dashboard template
// edits that point signup/recovery emails here. Locale for the button
// page's own text comes from the `next` param, not the URL.
//
// GET renders an inert HTML page and MUST NOT call verifyOtp. Email
// providers' security scanners (Gmail, Outlook Safe Links, etc.) prefetch
// links in incoming mail by issuing a plain GET before the real user ever
// opens the email — if that GET redeemed the one-time token, the scanner
// consumes it and the real click fails with "invalid or expired," which is
// exactly the production bug this file previously had. Only a POST (the
// button's form submit, which a scanner never issues) calls verifyOtp. Do
// not revert to redeeming on GET.
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function renderConfirmPage(params: {
  locale: "fr" | "ar";
  type: string;
  token_hash: string;
  next: string | null;
}) {
  const { locale, type, token_hash, next } = params;
  const t = await getTranslations({ locale, namespace: "auth.confirm" });
  const isRecovery = type === "recovery";
  const title = isRecovery ? t("recoveryTitle") : t("signupTitle");
  const buttonLabel = isRecovery ? t("recoveryButton") : t("signupButton");
  const dir = locale === "ar" ? "rtl" : "ltr";

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; padding: 1.5rem; background: #f7f7f7; color: #111; }
  main { max-width: 24rem; width: 100%; text-align: center; }
  p { color: #555; font-size: 0.9rem; line-height: 1.5; }
  button { width: 100%; padding: 0.75rem 1rem; border-radius: 0.5rem; border: none; background: #111; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 1rem; }
  button:hover { opacity: 0.9; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(t("instructions"))}</p>
  <form method="POST" action="/auth/confirm">
    <input type="hidden" name="token_hash" value="${escapeHtml(token_hash)}" />
    <input type="hidden" name="type" value="${escapeHtml(type)}" />
    ${next ? `<input type="hidden" name="next" value="${escapeHtml(next)}" />` : ""}
    <button type="submit">${escapeHtml(buttonLabel)}</button>
  </form>
</main>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function errorRedirect(origin: string, locale: "fr" | "ar", type: string | null) {
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

// GET: render the button page only. Never redeems the token.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next");
  const next = sanitizeNext(rawNext, origin);
  const locale = localeFromNext(next);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  // Legacy PKCE-style link (?code=... instead of ?token_hash=...): the old
  // exchangeCodeForSession-based /auth/callback this route replaced used
  // this shape. We deliberately don't support it here (that flow is the
  // cross-browser bug this route exists to fix) — surface a clear "request
  // a new link" outcome instead of a raw "missing token_hash" error.
  const legacyCode = searchParams.get("code");
  if (!token_hash && legacyCode) {
    logAuthEvent({
      action: "confirmRender",
      outcome: "failure",
      next: next ?? undefined,
      userAgent,
      error: "legacy code param, no token_hash",
    });
    return errorRedirect(origin, locale, type);
  }

  if (!token_hash || !type) {
    logAuthEvent({
      action: "confirmRender",
      outcome: "failure",
      otpType: type ?? undefined,
      next: next ?? undefined,
      hasTokenHash: Boolean(token_hash),
      userAgent,
      error: "missing token_hash or type",
    });
    return errorRedirect(origin, locale, type);
  }

  logAuthEvent({
    action: "confirmRender",
    outcome: "success",
    otpType: type,
    next: next ?? undefined,
    hasTokenHash: true,
    userAgent,
  });

  return renderConfirmPage({ locale, type, token_hash, next });
}

// POST: the button's form submit. Only place verifyOtp is called.
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const formData = await request.formData();
  const token_hash = formData.get("token_hash");
  const type = formData.get("type") as EmailOtpType | null;
  const rawNext = formData.get("next");
  const next = sanitizeNext(typeof rawNext === "string" ? rawNext : null, origin);
  const locale = localeFromNext(next);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  if (typeof token_hash !== "string" || !token_hash || !type) {
    logAuthEvent({
      action: "confirmRedeem",
      outcome: "failure",
      otpType: type ?? undefined,
      next: next ?? undefined,
      hasTokenHash: Boolean(token_hash),
      userAgent,
      error: "missing token_hash or type",
    });
    return errorRedirect(origin, locale, type);
  }

  // token_hash may arrive prefixed "pkce_" (seen in real production links,
  // since resetPasswordForEmail is PKCE-flow-eligible per Supabase's docs —
  // "Which authentication flows have PKCE support? ... Password Recovery").
  // Pass it through unchanged: every documented verifyOtp usage (the
  // reference page's "Verify Email Auth (Token Hash)" example, and the
  // email-templates guide's server-side-endpoint example) treats token_hash
  // as an opaque string with no client-side parsing or prefix handling —
  // verified via the Supabase MCP connector's search_docs before writing
  // this, not assumed. Stripping/transforming it would be guessing at an
  // internal GoTrue format with no documented basis.
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    logAuthEvent({
      action: "confirmRedeem",
      outcome: "failure",
      otpType: type,
      next: next ?? undefined,
      hasTokenHash: true,
      userAgent,
      error: error.message,
      errorCode: error.code,
    });
    return errorRedirect(origin, locale, type);
  }

  logAuthEvent({
    action: "confirmRedeem",
    outcome: "success",
    otpType: type,
    next: next ?? undefined,
    hasTokenHash: true,
    userAgent,
  });

  // Recovery always lands on the password form — never `next`, and never
  // the dashboard. This is the whole point of the flow: the user must set a
  // new password before doing anything else. Using `next` here (or falling
  // back to a dashboard-ish default) was the second production bug this
  // route had — a successful recovery verify landed signed-in on the
  // dashboard with the OLD password still in place. Signup confirmation
  // has no such requirement, so it keeps the sanitized `next` (with a
  // fallback to the bare locale homepage, not the dashboard, since we
  // shouldn't assume where an unknown/missing `next` should land).
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/${locale}/reset-password`);
  }
  return NextResponse.redirect(`${origin}${next ?? `/${locale}`}`);
}
