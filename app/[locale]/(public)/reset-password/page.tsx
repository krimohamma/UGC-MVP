import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { updatePassword } from "@/lib/auth/actions";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("auth.resetPassword");
  const searchParamsResolved = await searchParams;

  // This page only makes sense with the transient recovery session that
  // /auth/confirm established from the emailed link's token_hash — no
  // session means the link was never followed correctly, already used, or
  // expired.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/forgot-password?error=linkExpired", locale });
    return null as never;
  }

  const knownErrorCodes = ["passwordTooShort", "updateFailed"];
  const errorMessage =
    searchParamsResolved.error && knownErrorCodes.includes(searchParamsResolved.error)
      ? t(`errors.${searchParamsResolved.error}`)
      : null;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {errorMessage && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {errorMessage}
        </p>
      )}

      <form action={updatePassword} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("newPasswordLabel")}
          <input
            type="password"
            name="password"
            required
            minLength={8}
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          {t("submit")}
        </button>
      </form>
    </div>
  );
}
