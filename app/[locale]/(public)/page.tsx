import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getFeaturedGigs } from "@/lib/data/gigs";
import { GigCard } from "@/components/gigs/gig-card";

// Static + periodically revalidated — this is the most-seen page in the app.
// The page body itself is a plain server-rendered page with no client JS;
// SiteHeader's only client-side pieces are the locale switcher and the
// auth-dependent nav slice (SiteHeaderAuth), both pre-existing shared chrome
// rather than anything added for this page.
export const revalidate = 300;

function HowItWorksStep({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-2 text-start">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {number}
      </span>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Required (in addition to the root layout's call) for this page to
  // actually participate in static rendering — next-intl needs it set at
  // each segment that calls getTranslations, not just the root layout.
  setRequestLocale(locale);
  const t = await getTranslations("home");

  const featuredGigs = await getFeaturedGigs(6);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
          {t("heroSubtitle")}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/gigs"
            className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            {t("ctaBrowse")}
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-border px-6 py-3 text-sm font-bold transition-colors hover:bg-accent/50"
          >
            {t("ctaBecomeCreator")}
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-10 px-4 py-12 sm:py-16 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <h2 className="text-start text-xl font-bold">{t("howItWorksBrandsTitle")}</h2>
          <HowItWorksStep number={1} title={t("brandStep1Title")} desc={t("brandStep1Desc")} />
          <HowItWorksStep number={2} title={t("brandStep2Title")} desc={t("brandStep2Desc")} />
          <HowItWorksStep number={3} title={t("brandStep3Title")} desc={t("brandStep3Desc")} />
        </div>
        <div className="flex flex-col gap-6">
          <h2 className="text-start text-xl font-bold">{t("howItWorksCreatorsTitle")}</h2>
          <HowItWorksStep number={1} title={t("creatorStep1Title")} desc={t("creatorStep1Desc")} />
          <HowItWorksStep number={2} title={t("creatorStep2Title")} desc={t("creatorStep2Desc")} />
          <HowItWorksStep number={3} title={t("creatorStep3Title")} desc={t("creatorStep3Desc")} />
        </div>
      </section>

      {/* Featured gigs (live data) */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:py-16">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-start text-xl font-bold sm:text-2xl">{t("featuredGigsTitle")}</h2>
          <Link href="/gigs" className="text-sm font-semibold text-primary hover:underline">
            {t("viewAllGigs")} →
          </Link>
        </div>

        {featuredGigs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {t("featuredGigsEmpty")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {featuredGigs.map((gig) => (
              <GigCard key={gig.id} gig={gig} locale={locale} />
            ))}
          </div>
        )}
      </section>

      {/* Final CTA */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-16 text-center sm:py-24">
        <h2 className="text-2xl font-extrabold sm:text-3xl">{t("finalCtaTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("finalCtaSubtitle")}</p>
        <Link
          href="/signup"
          className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          {t("finalCtaButton")}
        </Link>
      </section>
    </div>
  );
}
