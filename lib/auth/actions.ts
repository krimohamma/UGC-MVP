"use server";

import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { signupSchema, emailSchema, passwordSchema } from "@/lib/validation/auth";
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
    redirect({
      href: `/signup?error=${encodeURIComponent(error?.message ?? "signupFailed")}`,
      locale,
    });
    return;
  }

  const { error: profileError } = await supabase.from("users").insert({
    id: data.user.id,
    role,
    email,
    password_hash: MANAGED_PASSWORD_PLACEHOLDER,
    full_name: fullName,
    locale,
  });

  if (profileError) {
    redirect({ href: `/signup?error=${encodeURIComponent(profileError.message)}`, locale });
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
