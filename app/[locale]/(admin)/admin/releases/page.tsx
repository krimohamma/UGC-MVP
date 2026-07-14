import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { EscrowReleaseList } from "@/components/admin/escrow-release-list";

export default async function AdminReleasesPage({
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

  // Authorize Admin
  const { data: userRecord } = await supabase
    .from("users")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (!userRecord || userRecord.role !== "admin") {
    redirect({ href: "/dashboard", locale });
    return null as never;
  }

  // Fetch pending escrow_release transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select(`
      id, 
      created_at, 
      amount_dzd, 
      orders(id, gigs(title), brand_id, creator_id)
    `)
    .eq("type", "escrow_release")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <div className="container mx-auto py-10 max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Admin Escrow Releases</h1>
      <p className="text-muted-foreground mb-8">
        These orders have been accepted by the brand. Confirm the release of funds to the creator's wallet.
      </p>
      <EscrowReleaseList transactions={transactions || []} />
    </div>
  );
}
