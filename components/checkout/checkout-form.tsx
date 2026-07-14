"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatDzd } from "@/lib/format";
import { createOrder } from "@/lib/actions/order";

interface CheckoutFormProps {
  gig: any;
  gigPackage: any;
  locale: string;
}

export function CheckoutForm({ gig, gigPackage, locale }: CheckoutFormProps) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const [requirements, setRequirements] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("gigId", gig.id);
    formData.append("packageId", gigPackage.id);
    if (requirements.trim()) {
      formData.append("requirements", requirements);
    }

    const result = await createOrder(formData);

    if (!result.success) {
      setError(result.error || "Something went wrong.");
      setIsSubmitting(false);
    } else {
      router.push(`/dashboard/orders/${result.orderId}/pay`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-8 py-8 px-4">
      <h1 className="text-3xl font-extrabold tracking-tight text-start">
        {t("checkoutTitle")}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Order Summary */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-lg font-bold border-b border-border pb-2 text-start">
            {t("orderSummary")}
          </h2>
          <div className="flex flex-col gap-2 text-sm text-start">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("gig")}:</span>
              <span className="font-semibold line-clamp-1 flex-1 text-end ps-4">{gig.title}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("package")}:</span>
              <span className="font-semibold capitalize">{gigPackage.tier}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("deliveryTime")}:</span>
              <span className="font-semibold">{gigPackage.delivery_days} {t("days")}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("revisions")}:</span>
              <span className="font-semibold">{gigPackage.revisions_included}</span>
            </div>
          </div>
          
          <div className="border-t border-border pt-4 mt-2 flex justify-between items-baseline text-start">
            <span className="font-bold text-base">{t("total")}</span>
            <span className="text-2xl font-extrabold text-primary font-mono">
              {formatDzd(gigPackage.price_dzd, locale as any)}
            </span>
          </div>
        </div>

        {/* Requirements Form */}
        <div className="flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-start">
              <label htmlFor="requirements" className="text-sm font-bold">
                {t("requirementsLabel")} <span className="text-muted-foreground font-normal">({t("optional")})</span>
              </label>
              <textarea
                id="requirements"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder={t("requirementsPlaceholder")}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm min-h-[120px] resize-y"
                maxLength={2000}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive font-semibold bg-destructive/10 p-3 rounded-lg text-start">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold shadow-sm disabled:opacity-50 transition-opacity hover:opacity-90 mt-4"
            >
              {isSubmitting ? t("processing") : t("continueToPayment")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
