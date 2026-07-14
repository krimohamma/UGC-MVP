"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { requestPayout } from "@/lib/actions/creator";
import { formatDzd } from "@/lib/format";
import type { AppLocale } from "@/i18n/routing";

interface PayoutRequestProps {
  availableBalanceDzd: number;
  pendingBalanceDzd: number;
  payoutAccountId: string | null;
  history: {
    id: string;
    amount_dzd: number;
    status: "pending" | "processing" | "paid" | "rejected";
    requested_at: string;
  }[];
}

export function PayoutRequest({ availableBalanceDzd, pendingBalanceDzd, payoutAccountId, history }: PayoutRequestProps) {
  const t = useTranslations("creatorPayouts");
  const locale = useLocale() as AppLocale;
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payoutAccountId) return;

    const amountDzd = Math.floor(Number(amount));
    if (!amountDzd || amountDzd <= 0 || amountDzd > availableBalanceDzd) {
      setMessage({ type: "error", text: t("minAmountError") });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    const res = await requestPayout({ amount_dzd: amountDzd, payout_account_id: payoutAccountId });
    if (res.success) {
      setMessage({ type: "success", text: t("requestSuccess") });
      setAmount("");
    } else {
      setMessage({ type: "error", text: t("requestFailed") });
    }
    setSubmitting(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-5">
      <h2 className="text-xl font-bold text-start">{t("title")}</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-muted/40 p-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("availableBalance")}</span>
          <span className="text-lg font-extrabold text-primary">{formatDzd(availableBalanceDzd, locale)}</span>
        </div>
        <div className="rounded-lg bg-muted/40 p-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("pendingBalance")}</span>
          <span className="text-lg font-extrabold">{formatDzd(pendingBalanceDzd, locale)}</span>
        </div>
      </div>

      {!payoutAccountId ? (
        <p className="text-sm text-muted-foreground text-start">{t("noPayoutAccount")}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {message && (
            <div
              className={`p-3 rounded-lg text-sm font-medium ${
                message.type === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
              }`}
            >
              {message.text}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={availableBalanceDzd}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={formatDzd(availableBalanceDzd, locale)}
              disabled={availableBalanceDzd <= 0}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-start text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={submitting || availableBalanceDzd <= 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? t("requesting") : t("requestButton")}
            </button>
          </div>
        </form>
      )}

      {history.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <h3 className="text-sm font-semibold text-start">{t("history")}</h3>
          {history.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span>{new Date(p.requested_at).toLocaleDateString()}</span>
              <span className="font-mono font-semibold">{formatDzd(p.amount_dzd, locale)}</span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                  p.status === "paid"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : p.status === "rejected"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {t(`status.${p.status}`)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
