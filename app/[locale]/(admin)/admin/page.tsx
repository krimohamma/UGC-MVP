import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

async function getCounts() {
  const supabase = await createClient();

  const [pendingEscrow, pendingDeliveries, pendingPayouts, activeGigs] = await Promise.all([
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("type", "escrow_hold").eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_admin_review"),
    supabase.from("payouts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("gigs").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  return {
    pendingEscrow: pendingEscrow.count ?? 0,
    pendingDeliveries: pendingDeliveries.count ?? 0,
    pendingPayouts: pendingPayouts.count ?? 0,
    activeGigs: activeGigs.count ?? 0,
  };
}

function QueueCard({
  label,
  count,
  href,
  viewLabel,
}: {
  label: string;
  count: number;
  href: string;
  viewLabel: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2 text-start"
    >
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-3xl font-extrabold tracking-tight">{count}</span>
      <span className="text-xs font-semibold text-primary">{viewLabel} →</span>
    </Link>
  );
}

export default async function AdminPage() {
  const t = await getTranslations("admin.home");
  const counts = await getCounts();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold text-start">{t("title")}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QueueCard
          label={t("pendingEscrow")}
          count={counts.pendingEscrow}
          href="/admin/transactions"
          viewLabel={t("viewQueue")}
        />
        <QueueCard
          label={t("pendingDeliveries")}
          count={counts.pendingDeliveries}
          href="/admin/deliveries"
          viewLabel={t("viewQueue")}
        />
        <QueueCard
          label={t("pendingPayouts")}
          count={counts.pendingPayouts}
          href="/admin/payouts"
          viewLabel={t("viewQueue")}
        />
        <QueueCard
          label={t("activeGigs")}
          count={counts.activeGigs}
          href="/admin/gigs"
          viewLabel={t("viewQueue")}
        />
      </div>
    </div>
  );
}
