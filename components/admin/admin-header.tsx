import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { signOut } from "@/lib/auth/actions";
import { getNotifications, getUnreadNotificationCount } from "@/lib/data/notifications";

export async function AdminHeader({ userId }: { userId: string }) {
  const t = await getTranslations("admin.nav");
  const tApp = await getTranslations("app");

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(userId),
    getUnreadNotificationCount(userId),
  ]);

  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-background/80 backdrop-blur dark:border-white/15">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-5">
          <Link href="/admin" className="text-lg font-semibold">
            {tApp("name")} <span className="text-muted-foreground text-sm font-normal">{t("adminBadge")}</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/admin" className="hover:underline">
              {t("dashboard")}
            </Link>
            <Link href="/admin/transactions" className="hover:underline">
              {t("escrow")}
            </Link>
            <Link href="/admin/deliveries" className="hover:underline">
              {t("deliveries")}
            </Link>
            <Link href="/admin/payouts" className="hover:underline">
              {t("payouts")}
            </Link>
            <Link href="/admin/gigs" className="hover:underline">
              {t("gigs")}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <NotificationBell userId={userId} initialNotifications={notifications} initialUnreadCount={unreadCount} />
          <form action={signOut}>
            <button type="submit" className="hover:underline">
              {t("logout")}
            </button>
          </form>
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
