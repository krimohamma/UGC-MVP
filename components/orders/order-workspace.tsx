"use client";

import { useTranslations } from "next-intl";
import { RealtimeChat } from "./realtime-chat";
import { DeliveryForm } from "./delivery-form";
import { ReviewDelivery } from "./review-delivery";
import { StatusTimeline } from "./status-timeline";
import { ReviewForm } from "./review-form";
import { Database } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";

type OrderWithDetails = Database["public"]["Tables"]["orders"]["Row"] & {
  gigs: { title: string } | null;
  order_deliverables: Database["public"]["Tables"]["order_deliverables"]["Row"][];
};

interface OrderWorkspaceProps {
  order: OrderWithDetails;
  role: "brand" | "creator" | "admin";
  conversationId: string;
  userId: string;
  statusHistory: Database["public"]["Tables"]["order_status_history"]["Row"][];
  reviews: Database["public"]["Tables"]["reviews"]["Row"][];
}

export function OrderWorkspace({ order, role, conversationId, userId, statusHistory, reviews }: OrderWorkspaceProps) {
  const t = useTranslations("workspace");

  const latestDeliverable = order.order_deliverables?.length > 0
    ? order.order_deliverables.sort((a, b) => b.revision_round - a.revision_round)[0]
    : null;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Left Column: Order details & Actions */}
      <div className="flex-1 overflow-y-auto border-e bg-background p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            {order.gigs?.title}
          </h1>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm">
              {t(`status.${order.status}`)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t("orderId")}: <span className="font-mono">{order.id.slice(0, 8)}</span>
            </span>
            {role === "admin" && (
              <Badge variant="outline" className="text-xs">
                {t("adminViewOnly")}
              </Badge>
            )}
          </div>
        </div>

        <hr className="border-t border-border" />

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("requirements")}</h2>
          <div className="p-4 bg-muted/30 rounded-lg text-sm text-foreground whitespace-pre-wrap">
            {order.requirements || t("noRequirements")}
          </div>
        </div>

        <hr className="border-t border-border" />

        <StatusTimeline history={statusHistory} />

        <hr className="border-t border-border" />

        {/* Action Area based on Role and Status */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("deliverables")}</h2>

          {role === "brand" && order.status === "pending_admin_review" && (
            <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {t("pendingAdminQC")}
              </p>
            </div>
          )}

          {role === "brand" && order.status === "delivered" && latestDeliverable && (
            <ReviewDelivery order={order} deliverable={latestDeliverable} />
          )}

          {role !== "creator" && ["completed", "disputed", "revision_requested"].includes(order.status) && latestDeliverable && (
            <div className="p-4 border rounded-lg">
              <p className="text-sm font-medium mb-2">{t("latestFile")}</p>
              <a href={latestDeliverable.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                {t("downloadFile")}
              </a>
            </div>
          )}

          {role === "creator" && ["in_progress", "revision_requested"].includes(order.status) && (
            <DeliveryForm order={order} />
          )}

          {role !== "brand" && ["pending_admin_review", "delivered", "completed", "disputed"].includes(order.status) && latestDeliverable && (
            <div className="p-4 border rounded-lg">
              <p className="text-sm font-medium mb-2">{t("latestFile")}</p>
              <a href={latestDeliverable.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                {t("downloadFile")}
              </a>
            </div>
          )}

        </div>

        {order.status === "completed" && (
          <>
            <hr className="border-t border-border" />
            {role === "admin" ? (
              reviews.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold">{t("reviewsTitle")}</h2>
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                      {r.direction} — {r.rating}/5 {r.comment && `— ${r.comment}`}
                    </div>
                  ))}
                </div>
              )
            ) : (
              <ReviewForm orderId={order.id} role={role} reviews={reviews} />
            )}
          </>
        )}
      </div>

      {/* Right Column: Chat (not shown to admins — they aren't a participant) */}
      {role !== "admin" && (
        <div className="w-full lg:w-96 flex flex-col bg-background border-t lg:border-t-0">
          <div className="p-4 border-b">
            <h2 className="font-semibold">{t("chat")}</h2>
          </div>
          <RealtimeChat conversationId={conversationId} userId={userId} />
        </div>
      )}
    </div>
  );
}
