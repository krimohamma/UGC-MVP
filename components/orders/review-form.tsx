"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { submitReview } from "@/lib/actions/review";
import type { Database } from "@/lib/database.types";
import { Star } from "lucide-react";

type Review = Database["public"]["Tables"]["reviews"]["Row"];

function StaticStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
      ))}
    </div>
  );
}

function ReviewCard({ label, review }: { label: string; review: Review }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <StaticStars rating={review.rating} />
      </div>
      {review.comment && <p className="text-sm text-start">{review.comment}</p>}
    </div>
  );
}

export function ReviewForm({
  orderId,
  role,
  reviews,
}: {
  orderId: string;
  role: "brand" | "creator";
  reviews: Review[];
}) {
  const t = useTranslations("reviews");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const myDirection = role === "brand" ? "brand_to_creator" : "creator_to_brand";
  const otherDirection = role === "brand" ? "creator_to_brand" : "brand_to_creator";

  const myReview = reviews.find((r) => r.direction === myDirection);
  const theirReview = reviews.find((r) => r.direction === otherDirection);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError(t("errors.ratingRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await submitReview({ orderId, rating, comment: comment.trim() || undefined });

    if (!res.success) {
      const knownErrors = ["ratingRequired", "already_reviewed"];
      setError(res.error && knownErrors.includes(res.error) ? t(`errors.${res.error}` as never) : t("submitFailed"));
    } else {
      setSubmitted(true);
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {myReview || submitted ? (
        <ReviewCard label={t("yourReview")} review={myReview ?? { id: "", order_id: orderId, direction: myDirection, reviewer_id: "", reviewee_id: "", rating, comment: comment || null, created_at: new Date().toISOString() }} />
      ) : (
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-background p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-start">{t("leaveReview")}</h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground text-start">{t("ratingLabel")}</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5"
                  aria-label={`${n}/5`}
                >
                  <Star
                    className={`h-6 w-6 ${
                      n <= (hoverRating || rating) ? "fill-amber-500 text-amber-500" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground text-start">{t("commentLabel")}</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("commentPlaceholder")}
              className="min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-start shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {error && <p className="text-xs text-destructive text-start">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? t("submitting") : t("submit")}
          </button>
        </form>
      )}

      {theirReview && <ReviewCard label={t("theirReview")} review={theirReview} />}
    </div>
  );
}
