import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PayoutList } from "@/components/admin/payout-list";

export default async function AdminPayoutsPage({
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

  const t = await getTranslations("admin.payouts");

  const { data: payouts } = await supabase
    .from("payouts")
    .select(
      `
      id,
      creator_id,
      amount_dzd,
      requested_at,
      users!payouts_creator_id_fkey(full_name),
      creator_payout_accounts(method, account_holder_name, account_number)
    `,
    )
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  return (
    <div className="flex flex-col gap-8 p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-2 text-start">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <PayoutList payouts={(payouts as any) ?? []} locale={locale} />
    </div>
  );
}
