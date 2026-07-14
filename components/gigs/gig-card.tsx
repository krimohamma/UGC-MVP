import Link from "next/link";
import Image from "next/image";
import { formatDzd } from "@/lib/format";

interface GigCardProps {
  gig: {
    id: string;
    title: string;
    cover_media_url?: string | null;
    base_price_dzd: number;
    avg_rating: number;
    orders_count: number;
    users?: {
      full_name: string;
      avatar_url?: string | null;
    } | null;
    niches?: {
      slug: string;
      name_fr: string;
      name_ar: string;
      name_en: string;
    } | null;
  };
  locale: string;
}

export function GigCard({ gig, locale }: GigCardProps) {
  const nicheName =
    locale === "ar"
      ? gig.niches?.name_ar
      : locale === "en"
      ? gig.niches?.name_en
      : gig.niches?.name_fr;

  const creatorName = gig.users?.full_name || "Créateur";
  const avatarUrl = gig.users?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(creatorName)}`;

  return (
    <Link
      href={`/${locale}/gigs/${gig.id}`}
      className="group rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
    >
      <div className="flex flex-col">
        {/* Media Cover */}
        <div className="relative aspect-video w-full bg-muted overflow-hidden">
          {gig.cover_media_url ? (
            <img
              src={gig.cover_media_url}
              alt={gig.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-accent/40 text-muted-foreground text-sm font-medium">
              UGC Video
            </div>
          )}
          {nicheName && (
            <span className="absolute top-2 start-2 rounded-full bg-background/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold text-foreground border border-border shadow-sm">
              {nicheName}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-4 flex flex-col gap-2">
          {/* Creator Profile */}
          <div className="flex items-center gap-2">
            <img
              src={avatarUrl}
              alt={creatorName}
              className="h-6 w-6 rounded-full object-cover border border-border"
            />
            <span className="text-xs font-medium text-muted-foreground truncate text-start">
              {creatorName}
            </span>
          </div>

          <h3 className="font-semibold text-sm line-clamp-2 text-start group-hover:text-primary transition-colors">
            {gig.title}
          </h3>
        </div>
      </div>

      {/* Footer Info & Price */}
      <div className="p-4 pt-0 border-t border-border/50 mt-2 flex items-center justify-between">
        {/* Rating — avg_rating is 0 until the gig's first review; showing a
            fabricated "5.0" there would misrepresent an unrated gig as
            perfectly rated. */}
        <div className="flex items-center gap-1 text-xs">
          {gig.avg_rating > 0 ? (
            <>
              <span className="text-amber-500 font-bold">★ {Number(gig.avg_rating).toFixed(1)}</span>
              <span className="text-muted-foreground">({gig.orders_count})</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {locale === "ar" ? "لا توجد تقييمات بعد" : "Pas encore d'avis"}
            </span>
          )}
        </div>

        {/* Base Price */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground font-medium">
            {locale === "ar" ? "ابتداءً من" : "À partir de"}
          </span>
          <span className="text-sm font-bold font-mono text-primary">
            {formatDzd(gig.base_price_dzd, locale as any)}
          </span>
        </div>
      </div>
    </Link>
  );
}
