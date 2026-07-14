"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth/actions";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { Database } from "@/lib/database.types";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

/**
 * Auth-dependent slice of the nav, split out of SiteHeader so the header
 * (rendered on every route, including the homepage) never has to call
 * `cookies()` server-side — that would force full dynamic rendering on
 * every page, defeating the homepage's static+ISR requirement. Session
 * state is instead read client-side after hydration; anonymous visitors
 * (the common case on a public marketplace homepage) see the logged-out
 * links immediately with no flash.
 */
export function SiteHeaderAuth() {
  const t = useTranslations("nav");
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled || !data.user) return;
      setUser({ id: data.user.id });

      const [{ data: notifs }, { count }] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", data.user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", data.user.id)
          .eq("is_read", false),
      ]);

      if (!cancelled) {
        setNotifications(notifs ?? []);
        setUnreadCount(count ?? 0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) {
    return (
      <>
        <Link href="/login" className="hover:underline">
          {t("login")}
        </Link>
        <Link
          href="/signup"
          className="rounded-full bg-foreground px-4 py-1.5 text-background"
        >
          {t("signup")}
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/dashboard" className="hover:underline">
        {t("dashboard")}
      </Link>
      <NotificationBell
        userId={user.id}
        initialNotifications={notifications}
        initialUnreadCount={unreadCount}
      />
      <form action={signOut}>
        <button type="submit" className="hover:underline">
          {t("logout")}
        </button>
      </form>
    </>
  );
}
