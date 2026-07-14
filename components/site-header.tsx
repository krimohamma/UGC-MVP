import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SiteHeaderAuth } from "@/components/site-header-auth";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const tApp = await getTranslations("app");

  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-background/80 backdrop-blur dark:border-white/15">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          {tApp("name")}
        </Link>

        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/gigs" className="hover:underline">
            {t("browseGigs")}
          </Link>

          <SiteHeaderAuth />

          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
