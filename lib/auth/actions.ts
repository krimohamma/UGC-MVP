"use server";

import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema, emailSchema, passwordSchema } from "@/lib/validation/auth";
import { logAuthEvent } from "@/lib/log";
import type { AppLocale } from "@/i18n/routing";

// Server Actions don't get a `request` object the way Route Handlers do
// (see app/auth/confirm/route.ts, which derives origin from request.url
// directly) — this reads the same info off the incoming request's headers,
// correctly reflecting Vercel's proxy (x-forwarded-*) in production and
// plain http/localhost in dev.
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// public.users.password_hash predates using Supabase Auth as the identity
// provider; Supabase manages real credentials in auth.users, so this column
// is never read. See CLAUDE.md for the follow-up migration to drop it.
const MANAGED_PASSWORD_PLACEHOLDER = "supabase_auth_managed";

export async function signup(formData: FormData) {
  const locale = (await getLocale()) as AppLocale;

  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message ?? "invalidRole";
    redirect({ href: `/signup?error=${code}`, locale });
    return;
  }

  const { fullName, email, password, role } = parsed.data;

  const supabase = await createClient();
  const origin = await getOrigin();

  // emailRedirectTo populates the {{ .RedirectTo }} template variable used
  // by the "Confirm signup" email template (see CLAUDE.md's Auth section) —
  // it's where /auth/confirm sends the user after a successful verifyOtp,
  // not a URL that's hit directly. Must be in the project's Redirect URLs
  // allow list or Supabase silently ignores it and falls back to the Site URL.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/${locale}/dashboard` },
  });

  if (error || !data.user) {
    // Never surface Supabase's raw auth-error text — it isn't one of our
    // translated codes, so the signup page's fallback rendering would show
    // it to the user verbatim. Generic message to the UI; real detail only
    // in the log.
    logAuthEvent({ action: "signupFailed", outcome: "failure", error: error?.message ?? "no user returned" });
    redirect({ href: "/signup?error=signupFailed", locale });
    return;
  }

  // Service-role client, not the RLS-scoped one above: this project requires
  // email confirmation, so signUp() doesn't establish a session in this same
  // request — auth.uid() is null here, and users_insert_self's RLS check
  // (auth.uid() = id) would reject the insert (this was a real production
  // bug: signUp() succeeded, this insert 42501'd, the user ended up with an
  // auth.users row and no public.users profile, and saw a raw error). Safe
  // to bypass RLS here specifically because `id` is `data.user.id` from
  // Supabase's own trusted signUp() response, never client input — see
  // lib/supabase/admin.ts's doc comment and 0002_rls_policies.sql's
  // users_insert_self comment, which flagged this exact scenario in advance.
  //
  // signUp() intentionally succeeds for an email that's already registered
  // (enumeration safety — see Supabase's own docs: re-signing up with an
  // existing email returns an "obfuscated user" and no new row), so this
  // insert can collide in two distinct, both-benign shapes that must NOT
  // surface as an error:
  //   (a) same id already present — a repeat signup attempt for the same
  //       still-unconfirmed account (violates users_pkey).
  //   (b) a DIFFERENT id with the SAME email — signUp() returned an
  //       obfuscated user for an email that's already registered to someone
  //       else's real account (violates users_email_key, not users_pkey);
  //       this is the exact production bug ("duplicate key value violates
  //       unique constraint users_email_key").
  // Either way: no new row is needed (the real profile already exists),
  // and the user must see the *same* generic "check your email" outcome
  // as a genuine new signup — anything else (an error banner, a different
  // message) would let an attacker distinguish "exists" from "doesn't"
  // by trying to sign up with an email and reading the response.
  const adminClient = createAdminClient();
  const { error: profileError } = await adminClient.from("users").insert({
    id: data.user.id,
    role,
    email,
    password_hash: MANAGED_PASSWORD_PLACEHOLDER,
    full_name: fullName,
    locale,
  });

  if (profileError) {
    if (profileError.code === "23505") {
      // Classify for the log only (never the raw message/details — both
      // embed the actual email value, e.g. "Key (email)=(...) already
      // exists" — so only derive a safe boolean from them, don't log them).
      const isEmailConflict = profileError.details?.includes("email") ?? false;
      logAuthEvent({
        action: "auth_signup_existing_email",
        outcome: "success",
        actorId: data.user.id,
        error: isEmailConflict ? "email conflict (different id)" : "repeat signup (same id)",
      });
      redirect({ href: "/login?signup=success", locale });
      return;
    }

    logAuthEvent({
      action: "signupProfileInsert",
      outcome: "failure",
      actorId: data.user.id,
      error: profileError.message,
      errorCode: profileError.code,
    });
    redirect({ href: "/signup?error=signupFailed", locale });
    return;
  }

  redirect({ href: "/login?signup=success", locale });
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const locale = (await getLocale()) as AppLocale;

  if (!email || !password) {
    redirect({ href: "/login?error=missing_fields", locale });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect({ href: `/login?error=${encodeURIComponent(error.message)}`, locale });
  }

  redirect({ href: "/dashboard", locale });
}

export async function requestPasswordReset(formData: FormData) {
  const locale = (await getLocale()) as AppLocale;
  const parsed = emailSchema.safeParse(formData.get("email"));

  if (!parsed.success) {
    redirect({ href: "/forgot-password?error=invalidEmail", locale });
    return;
  }

  const origin = await getOrigin();
  const supabase = await createClient();

  // redirectTo populates {{ .RedirectTo }} in the "Reset Password" email
  // template (see CLAUDE.md's Auth section) — it's where /auth/confirm
  // sends the user after a successful verifyOtp, not a URL Supabase hits
  // directly (that's why this is /reset-password, not /auth/confirm itself).
  // Must be in the project's Redirect URLs allow list or Supabase silently
  // falls back to the Site URL instead.
  //
  // Deliberately ignore the result: whether or not this address has an
  // account, always show the same "check your email" outcome. Branching on
  // success/failure here would let anyone enumerate registered emails by
  // trying addresses and watching which ones "fail".
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/${locale}/reset-password`,
  });

  redirect({ href: "/forgot-password?sent=1", locale });
}

export async function updatePassword(formData: FormData) {
  const locale = (await getLocale()) as AppLocale;
  const parsed = passwordSchema.safeParse(formData.get("password"));

  if (!parsed.success) {
    redirect({ href: "/reset-password?error=passwordTooShort", locale });
    return;
  }

  const supabase = await createClient();
  // Requires the transient recovery session that /auth/confirm established
  // from the emailed link's token_hash — if that's missing or expired, this
  // fails.
  const { error } = await supabase.auth.updateUser({ password: parsed.data });

  if (error) {
    redirect({ href: "/reset-password?error=updateFailed", locale });
    return;
  }

  redirect({ href: "/login?reset=success", locale });
}

export async function signOut() {
  const supabase = await createClient();
  const locale = (await getLocale()) as AppLocale;
  await supabase.auth.signOut();
  redirect({ href: "/", locale });
}
