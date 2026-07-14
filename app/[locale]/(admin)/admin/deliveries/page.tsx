import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { DeliveryReviewList } from "@/components/admin/delivery-review-list";

export default async function AdminDeliveriesPage({
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

  // Fetch pending_admin_review orders with their deliverables
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      status,
      created_at,
      brand_id,
      creator_id,
      gigs(title),
      order_deliverables(*)
    `)
    .eq("status", "pending_admin_review")
    .order("updated_at", { ascending: false });

  // `deliverables` is a private bucket; file_url is a raw storage path (see
  // delivery-form.tsx) — sign it for display, same as the receipts pattern
  // in admin/transactions/page.tsx.
  const ordersWithSignedDeliverables = await Promise.all(
    (orders ?? []).map(async (order) => ({
      ...order,
      order_deliverables: await Promise.all(
        (order.order_deliverables ?? []).map(async (d) => {
          const { data } = await supabase.storage
            .from("deliverables")
            .createSignedUrl(d.file_url, 60 * 60);
          return { ...d, file_url: data?.signedUrl ?? "" };
        }),
      ),
    })),
  );

  return (
    <div className="container mx-auto py-10 max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Admin QC: Pending Deliveries</h1>
      <DeliveryReviewList orders={ordersWithSignedDeliverables} />
    </div>
  );
}
