"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDzd } from "@/lib/format";
import { processPayout } from "@/lib/actions/admin";

interface PayoutRow {
  id: string;
  creator_id: string;
  amount_dzd: number;
  requested_at: string;
  users: { full_name: string } | null;
  creator_payout_accounts: { method: string; account_holder_name: string; account_number: string } | null;
}

export function PayoutList({ payouts, locale }: { payouts: PayoutRow[]; locale: string }) {
  const t = useTranslations("admin.payouts");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(id: string, action: "paid" | "rejected") {
    setProcessingId(id);
    setError(null);
    const result = await processPayout(id, action);
    if (!result.success) {
      setError(result.error || t("actionFailed"));
    }
    setProcessingId(null);
  }

  if (payouts.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl bg-card">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm font-bold text-start">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm text-start">
          <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
            <tr>
              <th className="px-4 py-3 text-start">{t("creator")}</th>
              <th className="px-4 py-3 text-start">{t("amount")}</th>
              <th className="px-4 py-3 text-start">{t("method")}</th>
              <th className="px-4 py-3 text-start">{t("account")}</th>
              <th className="px-4 py-3 text-start">{t("requestedAt")}</th>
              <th className="px-4 py-3 text-end">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payouts.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">{p.users?.full_name ?? p.creator_id.slice(0, 8)}</td>
                <td className="px-4 py-3 font-mono font-bold text-primary">{formatDzd(p.amount_dzd, locale as any)}</td>
                <td className="px-4 py-3 uppercase font-semibold">{p.creator_payout_accounts?.method}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {p.creator_payout_accounts?.account_holder_name} — {p.creator_payout_accounts?.account_number}
                </td>
                <td className="px-4 py-3 text-xs">{new Date(p.requested_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-end">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleAction(p.id, "rejected")}
                      disabled={processingId === p.id}
                      className="rounded-lg border border-destructive/40 text-destructive px-3 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      {t("reject")}
                    </button>
                    <button
                      onClick={() => handleAction(p.id, "paid")}
                      disabled={processingId === p.id}
                      className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold shadow-sm disabled:opacity-50"
                    >
                      {processingId === p.id ? t("processing") : t("markPaid")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
