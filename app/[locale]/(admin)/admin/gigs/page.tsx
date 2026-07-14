import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { GigModerationList } from "@/components/admin/gig-moderation-list";
import type { AppLocale } from "@/i18n/routing";

export default async function AdminGigsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData?.user) {
    redirect({ href: "/login", locale });
    return null as never;
  }

  const { data: userRecord } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
  if (!userRecord || userRecord.role !== "admin") {
    redirect({ href: "/dashboard", locale });
    return null as never;
  }

  const t = await getTranslations("admin.gigsModeration");

  const { data: gigs } = await supabase
    .from("gigs")
    .select("id, title, status, base_price_dzd, users(full_name)")
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8 p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-2 text-start">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <GigModerationList gigs={(gigs as any) ?? []} locale={locale as AppLocale} />
    </div>
  );
}
