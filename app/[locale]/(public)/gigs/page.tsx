import { getTranslations } from "next-intl/server";
import { getNiches, getLanguages } from "@/lib/data/lookups";
import { getGigs } from "@/lib/data/gigs";
import { GigFilters } from "@/components/gigs/gig-filters";
import { GigCard } from "@/components/gigs/gig-card";

export default async function GigsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    niche?: string;
    lang?: string;
    min_price?: string;
    max_price?: string;
    max_delivery?: string;
  }>;
}) {
  const { locale } = await params;
  const sParams = await searchParams;
  const t = await getTranslations("gigs");

  const filters = {
    niche_id: sParams.niche,
    language_code: sParams.lang,
    min_price: sParams.min_price ? parseInt(sParams.min_price, 10) : undefined,
    max_price: sParams.max_price ? parseInt(sParams.max_price, 10) : undefined,
    max_delivery_days: sParams.max_delivery
      ? parseInt(sParams.max_delivery, 10)
      : undefined,
  };

  const [gigs, niches, languages] = await Promise.all([
    getGigs(filters),
    getNiches(),
    getLanguages(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-start tracking-tight">
          {t("browseTitle")}
        </h1>
        <p className="text-sm text-muted-foreground text-start">
          {t("browseSubtitle")}
        </p>
      </div>

      {/* Filters Bar */}
      <GigFilters niches={niches} languages={languages} />

      {/* Gigs Grid */}
      {gigs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground text-sm">
          {t("browseEmpty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {gigs.map((gig) => (
            <GigCard key={gig.id} gig={gig} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
