import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const t = await getTranslations("footer");
  const tApp = await getTranslations("app");

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="text-start">
          {tApp("name")} — {t("tagline")}
        </p>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/gigs" className="hover:underline">
            {t("browseGigs")}
          </Link>
          <Link href="/terms" className="hover:underline">
            {t("terms")}
          </Link>
          <Link href="/privacy" className="hover:underline">
            {t("privacy")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
