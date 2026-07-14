"use client";

import { useTranslations } from "next-intl";
import type { Database } from "@/lib/database.types";
import { CheckCircle2 } from "lucide-react";

type StatusHistoryRow = Database["public"]["Tables"]["order_status_history"]["Row"];

export function StatusTimeline({ history }: { history: StatusHistoryRow[] }) {
  const t = useTranslations("workspace");

  // Side paths (revision_requested/disputed/cancelled) don't belong on the
  // fixed happy-path rail — render the actual history chronologically
  // instead of trying to force it onto a linear track.
  const sorted = [...history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  if (sorted.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-start">{t("timeline")}</h2>
      <ol className="flex flex-col gap-0">
        {sorted.map((entry, idx) => (
          <li key={entry.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              {idx < sorted.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
            </div>
            <div className="pb-4 flex flex-col gap-0.5 text-start">
              <span className="text-sm font-medium">{t(`status.${entry.to_status}`)}</span>
              {entry.note && <span className="text-xs text-muted-foreground">{entry.note}</span>}
              <span className="text-[11px] text-muted-foreground">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
