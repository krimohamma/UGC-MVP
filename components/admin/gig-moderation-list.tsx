"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDzd } from "@/lib/format";
import { adminSetGigStatus } from "@/lib/actions/admin";
import type { AppLocale } from "@/i18n/routing";

interface GigRow {
  id: string;
  title: string;
  status: "draft" | "active" | "paused" | "archived";
  base_price_dzd: number;
  users: { full_name: string } | null;
}

export function GigModerationList({ gigs, locale }: { gigs: GigRow[]; locale: AppLocale }) {
  const t = useTranslations("admin.gigsModeration");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(gigId: string, currentStatus: string) {
    setProcessingId(gigId);
    setError(null);
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    const res = await adminSetGigStatus(gigId, nextStatus);
    if (!res.success) {
      setError(res.error || t("actionFailed"));
    }
    setProcessingId(null);
  }

  if (gigs.length === 0) {
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
              <th className="px-4 py-3 text-start">Gig</th>
              <th className="px-4 py-3 text-start">{t("creator")}</th>
              <th className="px-4 py-3 text-start">{t("status")}</th>
              <th className="px-4 py-3 text-end">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {gigs.map((g) => (
              <tr key={g.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold line-clamp-1">{g.title}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDzd(g.base_price_dzd, locale)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">{g.users?.full_name ?? "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      g.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {g.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-end">
                  {(g.status === "active" || g.status === "paused") && (
                    <button
                      onClick={() => handleToggle(g.id, g.status)}
                      disabled={processingId === g.id}
                      className={`rounded-lg px-4 py-2 text-xs font-bold shadow-sm disabled:opacity-50 ${
                        g.status === "active"
                          ? "border border-destructive/40 text-destructive"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {g.status === "active" ? t("deactivate") : t("reactivate")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
