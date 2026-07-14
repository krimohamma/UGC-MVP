import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { PaymentProofForm } from "@/components/checkout/payment-proof-form";

export default async function PaymentProofPage({
  params,
}: {
  params: Promise<{ locale: string; orderId: string }>;
}) {
  const { locale, orderId } = await params;
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    redirect({ href: "/login", locale });
    return null as never;
  }

  // Fetch order details
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!order || order.brand_id !== authData.user.id) {
    redirect({ href: "/dashboard", locale });
    return null as never;
  }

  if (order.status !== "pending_payment") {
    // If they already paid, go back to dashboard
    redirect({ href: "/dashboard", locale });
    return null as never;
  }

  return (
    <div className="flex flex-1 flex-col w-full bg-muted/20">
      <PaymentProofForm order={order} locale={locale} />
    </div>
  );
}
