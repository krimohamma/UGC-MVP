"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// Next.js requires error.tsx to be a Client Component (it needs to catch
// render errors thrown on the client too, via React's error boundary
// mechanism) — this is the one legitimate exception to "no client JS beyond
// the locale switcher" elsewhere on public pages, since Next.js's own API
// leaves no server-only option here.
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground/70">{t("errorId")}: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {t("retry")}
        </button>
        <Link
          href="/"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent/50"
        >
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
