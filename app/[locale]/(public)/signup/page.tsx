import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { signup } from "@/lib/auth/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("auth.signup");
  const params = await searchParams;

  // Known validation error codes (from lib/validation/auth.ts) get a
  // localized message; anything else (e.g. Supabase's own signUp() error
  // text) is shown as-is — see CLAUDE.md's i18n section on that gap.
  const knownErrorCodes = ["required", "invalidEmail", "passwordTooShort", "invalidRole", "signupFailed"];
  const errorMessage = params.error
    ? knownErrorCodes.includes(params.error)
      ? t(`errors.${params.error}`)
      : params.error
    : null;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {errorMessage && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {errorMessage}
        </p>
      )}

      <form action={signup} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("displayName")}
          <input
            name="fullName"
            required
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("email")}
          <input
            type="email"
            name="email"
            required
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("password")}
          <input
            type="password"
            name="password"
            required
            minLength={8}
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"
          />
        </label>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">{t("role")}</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="creator" required defaultChecked />
            {t("roleCreator")}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="brand" />
            {t("roleBrand")}
          </label>
        </fieldset>

        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          {t("submit")}
        </button>
      </form>

      <p className="text-xs text-foreground/60">
        {t.rich("legalNotice", {
          terms: (chunks) => (
            <Link href="/terms" className="underline underline-offset-4">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/privacy" className="underline underline-offset-4">
              {chunks}
            </Link>
          ),
        })}
      </p>

      <p className="text-sm text-foreground/70">
        {t("hasAccount")}{" "}
        <Link href="/login" className="font-medium underline underline-offset-4">
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}
