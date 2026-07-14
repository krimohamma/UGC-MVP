"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import type { Niche, Language } from "@/lib/data/lookups";

interface GigFiltersProps {
  niches: Niche[];
  languages: Language[];
}

export function GigFilters({ niches, languages }: GigFiltersProps) {
  const t = useTranslations("gigs");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentNiche = searchParams.get("niche") || "";
  const currentLang = searchParams.get("lang") || "";
  const currentMinPrice = searchParams.get("min_price") || "";
  const currentMaxPrice = searchParams.get("max_price") || "";
  const currentDelivery = searchParams.get("max_delivery") || "";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetFilters() {
    router.push(pathname);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-center gap-3">
      {/* Niche Filter */}
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label className="text-[11px] font-semibold text-muted-foreground text-start">
          {t("filterNiche")}
        </label>
        <select
          value={currentNiche}
          onChange={(e) => updateFilter("niche", e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-start focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">{t("allNiches")}</option>
          {niches.map((niche) => {
            const name =
              locale === "ar"
                ? niche.name_ar
                : locale === "en"
                ? niche.name_en
                : niche.name_fr;
            return (
              <option key={niche.id} value={niche.id}>
                {name}
              </option>
            );
          })}
        </select>
      </div>

      {/* Language Filter */}
      <div className="flex flex-col gap-1 min-w-[130px]">
        <label className="text-[11px] font-semibold text-muted-foreground text-start">
          {t("filterLanguage")}
        </label>
        <select
          value={currentLang}
          onChange={(e) => updateFilter("lang", e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-start focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">{t("allLanguages")}</option>
          {languages.map((lang) => {
            const name =
              locale === "ar"
                ? lang.name_ar
                : locale === "en"
                ? lang.name_en
                : lang.name_fr;
            return (
              <option key={lang.code} value={lang.code}>
                {name}
              </option>
            );
          })}
        </select>
      </div>

      {/* Price Range */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-muted-foreground text-start">
          {t("priceRange")}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            placeholder="Min"
            value={currentMinPrice}
            onChange={(e) => updateFilter("min_price", e.target.value)}
            className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-xs text-start font-mono"
          />
          <span className="text-xs text-muted-foreground">-</span>
          <input
            type="number"
            placeholder="Max"
            value={currentMaxPrice}
            onChange={(e) => updateFilter("max_price", e.target.value)}
            className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-xs text-start font-mono"
          />
        </div>
      </div>

      {/* Max Delivery Days */}
      <div className="flex flex-col gap-1 min-w-[120px]">
        <label className="text-[11px] font-semibold text-muted-foreground text-start">
          {t("maxDelivery")}
        </label>
        <select
          value={currentDelivery}
          onChange={(e) => updateFilter("max_delivery", e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-start focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">{t("anyTime")}</option>
          <option value="3">≤ 3 days</option>
          <option value="5">≤ 5 days</option>
          <option value="7">≤ 7 days</option>
        </select>
      </div>

      {/* Reset */}
      {(currentNiche || currentLang || currentMinPrice || currentMaxPrice || currentDelivery) && (
        <div className="flex flex-col justify-end ms-auto pt-4 sm:pt-0">
          <button
            onClick={resetFilters}
            className="text-xs font-semibold text-destructive hover:underline"
          >
            {t("resetFilters")}
          </button>
        </div>
      )}
    </div>
  );
}
