import type { AppLocale } from "@/i18n/routing";

/**
 * Format an integer DZD amount for display. Money is always stored as a whole
 * number of dinars (see CLAUDE.md), so there are never fractional digits.
 */
export function formatDzd(amountDzd: number, locale: AppLocale): string {
  const intlLocale = locale === "ar" ? "ar-DZ" : "fr-DZ";
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 0,
  }).format(amountDzd);
}

/** A row from `niches` / `languages` carrying the three localized name columns. */
type LocalizedNames = {
  name_fr: string;
  name_ar: string;
  name_en: string;
};

/**
 * Pick the localized label for an admin-curated lookup row (`niches`,
 * `languages`). The `en` UI locale isn't routed yet (only fr/ar), but the
 * column exists, so this stays exhaustive.
 */
export function localizedName(row: LocalizedNames, locale: AppLocale): string {
  if (locale === "ar") return row.name_ar;
  return row.name_fr;
}
