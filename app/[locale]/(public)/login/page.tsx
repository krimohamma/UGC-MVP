import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { login } from "@/lib/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; signup?: string; reset?: string }>;
}) {
  const t = await getTranslations("auth.login");
  const params = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {params.signup === "success" && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          {t("checkEmailNotice")}
        </p>
      )}
      {params.reset === "success" && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          {t("resetSuccessNotice")}
        </p>
      )}
      {params.error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {params.error}
        </p>
      )}

      <form action={login} className="flex flex-col gap-4">
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
        <Link
          href="/forgot-password"
          className="text-start text-sm text-foreground/70 underline underline-offset-4"
        >
          {t("forgotPasswordLink")}
        </Link>
        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          {t("submit")}
        </button>
      </form>

      <p className="text-sm text-foreground/70">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-medium underline underline-offset-4">
          {t("signupLink")}
        </Link>
      </p>
    </div>
  );
}
