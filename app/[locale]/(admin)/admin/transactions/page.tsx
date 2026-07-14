import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { TransactionList } from "@/components/admin/transaction-list";

export default async function AdminTransactionsPage({
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

  // Authorize
  const { data: userRecord } = await supabase
    .from("users")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (!userRecord || userRecord.role !== "admin") {
    redirect({ href: "/dashboard", locale });
  }

  // Fetch pending escrow_hold transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, orders(brand_id)")
    .eq("type", "escrow_hold")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const txs = transactions || [];

  // Generate signed URLs for receipts so the admin can securely view them
  const txsWithSignedUrls = await Promise.all(
    txs.map(async (tx) => {
      let signedUrl = null;
      if (tx.proof_image_url) {
        const { data } = await supabase.storage
          .from("receipts")
          .createSignedUrl(tx.proof_image_url, 60 * 60); // 1 hour expiry
        
        if (data?.signedUrl) {
          signedUrl = data.signedUrl;
        }
      }
      return { ...tx, proof_image_url: signedUrl || tx.proof_image_url };
    })
  );

  return (
    <div className="flex flex-col gap-8 p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-2 text-start">
        <h1 className="text-3xl font-extrabold tracking-tight">Pending Payments</h1>
        <p className="text-muted-foreground">
          Verify manual escrow transfers (CCP / BaridiMob) and confirm them to move orders into progress.
        </p>
      </div>

      <TransactionList transactions={txsWithSignedUrls} locale={locale} />
    </div>
  );
}
