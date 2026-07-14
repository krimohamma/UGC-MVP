import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requestPasswordReset } from "@/lib/auth/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const t = await getTranslations("auth.forgotPassword");
  const params = await searchParams;

  const knownErrorCodes = ["invalidEmail", "linkExpired"];
  const errorMessage =
    params.error && knownErrorCodes.includes(params.error) ? t(`errors.${params.error}`) : null;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {params.sent === "1" ? (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          {t("checkEmailNotice")}
        </p>
      ) : (
        <>
          <p className="text-sm text-foreground/70">{t("instructions")}</p>

          {errorMessage && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </p>
          )}

          <form action={requestPasswordReset} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              {t("emailLabel")}
              <input
                type="email"
                name="email"
                required
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
        </>
      )}

      <p className="text-sm text-foreground/70">
        <Link href="/login" className="font-medium underline underline-offset-4">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
