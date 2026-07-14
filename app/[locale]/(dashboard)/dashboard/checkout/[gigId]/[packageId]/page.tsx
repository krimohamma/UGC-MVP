import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string; gigId: string; packageId: string }>;
}) {
  const { locale, gigId, packageId } = await params;
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    redirect({ href: "/login", locale });
    return null as never;
  }

  // Fetch gig and package details
  const { data: gigPackage } = await supabase
    .from("gig_packages")
    .select("*, gigs(*)")
    .eq("id", packageId)
    .single();

  if (!gigPackage || gigPackage.gig_id !== gigId) {
    redirect({ href: `/gigs/${gigId}`, locale });
    return null as never;
  }

  const gig = gigPackage.gigs;

  return (
    <div className="flex flex-1 flex-col w-full bg-muted/20">
      <CheckoutForm gig={gig} gigPackage={gigPackage} locale={locale} />
    </div>
  );
}
