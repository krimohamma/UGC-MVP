"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatDzd } from "@/lib/format";

interface GigDetailViewProps {
  gig: any;
  locale: string;
}

export function GigDetailView({ gig, locale }: GigDetailViewProps) {
  const t = useTranslations("gigDetail");
  const [selectedTier, setSelectedTier] = useState<"basic" | "standard" | "premium">("basic");

  const creator = gig.users;
  const creatorProfile = creator?.creator_profiles;
  const avatarUrl =
    creator?.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(creator?.full_name || "Creator")}`;

  const packages = gig.gig_packages || [];
  const activePackage =
    packages.find((p: any) => p.tier === selectedTier) || packages[0];

  const nicheName =
    locale === "ar"
      ? gig.niches?.name_ar
      : locale === "en"
      ? gig.niches?.name_en
      : gig.niches?.name_fr;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8">
      {/* Header Info */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {nicheName && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {nicheName}
            </span>
          )}
          {gig.gig_languages?.map((gl: any) => {
            const langName =
              locale === "ar"
                ? gl.languages?.name_ar
                : locale === "en"
                ? gl.languages?.name_en
                : gl.languages?.name_fr;
            return (
              <span
                key={gl.language_code}
                className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
              >
                {langName}
              </span>
            );
          })}
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-start tracking-tight">
          {gig.title}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Cols: Media, Description, Creator Profile, Portfolio */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* Main Cover Image */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-muted shadow-sm border border-border">
            {gig.cover_media_url ? (
              <img
                src={gig.cover_media_url}
                alt={gig.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent/40 text-muted-foreground text-base font-semibold">
                UGC Service Cover
              </div>
            )}
          </div>

          {/* Description */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-3">
            <h2 className="text-lg font-bold text-start border-b border-border pb-3">
              {t("descriptionTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line text-start">
              {gig.description}
            </p>
          </div>

          {/* Creator Info Card */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row gap-5 items-start">
            <img
              src={avatarUrl}
              alt={creator?.full_name || "Creator"}
              className="h-16 w-16 rounded-full object-cover border-2 border-primary/20 shadow-sm flex-shrink-0"
            />
            <div className="flex flex-col gap-2 text-start flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold">{creator?.full_name}</h3>
                {creatorProfile?.rating_count > 0 ? (
                  <div className="flex items-center gap-1.5 text-xs bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-200 text-amber-600 font-semibold">
                    <span>★ {Number(creatorProfile.rating_avg).toFixed(1)}</span>
                    <span>({creatorProfile.rating_count})</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {locale === "ar" ? "لا توجد تقييمات بعد" : "Pas encore d'avis"}
                  </span>
                )}
              </div>

              {creatorProfile?.bio && (
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {creatorProfile.bio}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground pt-1">
                <span>
                  {t("ordersCompleted")}: {creatorProfile?.completed_orders_count || 0}
                </span>
                {creatorProfile?.years_experience ? (
                  <span>
                    {t("experience")}: {creatorProfile.years_experience} {t("years")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Portfolio Samples */}
          {gig.portfolio && gig.portfolio.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4">
              <h2 className="text-lg font-bold text-start border-b border-border pb-3">
                {t("portfolioTitle")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {gig.portfolio.map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-background p-3 flex flex-col gap-2"
                  >
                    <h4 className="text-xs font-semibold line-clamp-1 text-start">
                      {item.title || "Sample Clip"}
                    </h4>
                    {item.external_url ? (
                      <a
                        href={item.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline truncate text-start block"
                      >
                        {item.external_url}
                      </a>
                    ) : item.video_url ? (
                      <video
                        src={item.video_url}
                        controls
                        className="w-full aspect-video rounded-md bg-black object-cover"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Interactive Package Card & Checkout Placeholder */}
        <div className="lg:col-span-1 sticky top-24 flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card shadow-md overflow-hidden flex flex-col">
            {/* Tier Selector Tabs */}
            <div className="grid grid-cols-3 bg-muted border-b border-border p-1">
              {(["basic", "standard", "premium"] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={`py-2 text-xs font-bold rounded-lg capitalize transition-colors ${
                    selectedTier === tier
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            {/* Package Details */}
            {activePackage ? (
              <div className="p-6 flex flex-col gap-5 text-start">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-extrabold text-lg">{activePackage.title}</h3>
                  <span className="text-xl font-extrabold font-mono text-primary">
                    {formatDzd(activePackage.price_dzd, locale as any)}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {activePackage.description}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs font-medium bg-accent/40 p-3 rounded-lg">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {t("deliveryTime")}
                    </span>
                    <span className="font-bold">{activePackage.delivery_days} {t("days")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {t("revisions")}
                    </span>
                    <span className="font-bold">{activePackage.revisions_included}</span>
                  </div>
                </div>

                {/* Features List */}
                {activePackage.features && activePackage.features.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold">{t("whatsIncluded")}:</span>
                    <ul className="flex flex-col gap-1.5">
                      {activePackage.features.map((feat: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2 text-xs">
                          <span className="text-primary font-bold">✓</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Order Button */}
                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href={`/dashboard/checkout/${gig.id}/${activePackage.id}`}
                    className="w-full flex items-center justify-center rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold shadow-sm transition-opacity hover:opacity-90"
                  >
                    {t("orderNow")}
                  </Link>
                  <p className="text-[11px] text-center text-muted-foreground">
                    {t("orderNote")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground text-sm">
                {t("noPackageInfo")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
