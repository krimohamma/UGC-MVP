import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { OrderWorkspace } from "@/components/orders/order-workspace";

export default async function OrderWorkspacePage({
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

  // Fetch Order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, gigs(title), order_deliverables(*)")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    redirect({ href: "/dashboard", locale });
    return null as never;
  }

  const { data: userRecord } = await supabase.from("users").select("role").eq("id", authData.user.id).single();
  const isAdmin = userRecord?.role === "admin";
  const isParty = order.brand_id === authData.user.id || order.creator_id === authData.user.id;

  if (!isParty && !isAdmin) {
    redirect({ href: "/dashboard", locale });
    return null as never;
  }

  const role: "brand" | "creator" | "admin" = isAdmin && !isParty
    ? "admin"
    : authData.user.id === order.brand_id
      ? "brand"
      : "creator";

  // `deliverables` is a private bucket; order.order_deliverables.file_url is
  // a raw storage path (see delivery-form.tsx), not a usable URL. Sign it
  // here — this also naturally enforces the same access rule as the
  // storage.objects RLS policies (e.g. a brand gets no signed URL while the
  // order is still pending_admin_review, since createSignedUrl is itself
  // gated by the caller's SELECT policy on storage.objects).
  const signedDeliverables = await Promise.all(
    (order.order_deliverables ?? []).map(async (d) => {
      const { data } = await supabase.storage
        .from("deliverables")
        .createSignedUrl(d.file_url, 60 * 60);
      return { ...d, file_url: data?.signedUrl ?? "" };
    }),
  );
  const orderWithSignedDeliverables = { ...order, order_deliverables: signedDeliverables };

  // Status history (for the timeline) and reviews — both readable by any
  // party or admin per RLS (order_status_history_select_party_or_admin,
  // reviews_select_public).
  const { data: statusHistory } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  const { data: reviews } = await supabase.from("reviews").select("*").eq("order_id", orderId);

  // Fetch or create conversation (brand/creator only — admin doesn't join it).
  let conversation: { id: string } | null = null;
  if (role !== "admin") {
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("order_id", orderId)
      .single();

    conversation = existingConv;

    if (!conversation) {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          brand_id: order.brand_id,
          creator_id: order.creator_id,
          order_id: orderId,
        })
        .select("id")
        .single();

      conversation = newConv;
    }
  }

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <OrderWorkspace
        order={orderWithSignedDeliverables}
        role={role}
        conversationId={conversation?.id || ""}
        userId={authData.user.id}
        statusHistory={statusHistory ?? []}
        reviews={reviews ?? []}
      />
    </div>
  );
}
