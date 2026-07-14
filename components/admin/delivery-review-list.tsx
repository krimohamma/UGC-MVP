"use client";

import { useState } from "react";
import { adminApproveDelivery, adminRejectDelivery } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X } from "lucide-react";

export function DeliveryReviewList({ orders }: { orders: any[] }) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<{ [key: string]: string }>({});

  const handleApprove = async (orderId: string) => {
    setProcessing(orderId);
    await adminApproveDelivery(orderId);
    setProcessing(null);
  };

  const handleReject = async (orderId: string) => {
    const note = rejectNote[orderId];
    if (!note || note.trim() === "") {
      alert("Please provide a rejection reason.");
      return;
    }
    setProcessing(orderId);
    await adminRejectDelivery(orderId, note);
    setProcessing(null);
  };

  if (!orders || orders.length === 0) {
    return <div className="p-8 text-center text-muted-foreground border rounded-lg bg-background">No pending deliveries.</div>;
  }

  return (
    <div className="space-y-6">
      {orders.map((order) => {
        const latestDeliverable = order.order_deliverables?.length > 0 
          ? order.order_deliverables.sort((a: any, b: any) => b.revision_round - a.revision_round)[0]
          : null;

        return (
          <div key={order.id} className="p-6 border rounded-lg bg-background shadow-sm flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{order.gigs?.title}</h3>
                <p className="text-sm text-muted-foreground font-mono">Order ID: {order.id}</p>
                <p className="text-sm text-muted-foreground">Creator ID: {order.creator_id}</p>
              </div>

              {latestDeliverable && (
                <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center w-full max-w-md">
                  <video controls className="w-full h-full" src={latestDeliverable.file_url}>
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
            </div>

            <div className="w-full lg:w-80 space-y-4">
              <h4 className="font-medium">QC Actions</h4>
              <p className="text-sm text-muted-foreground">
                Review the video and approve it so the brand can review it, or reject it to send it back to the creator.
              </p>
              
              <Button 
                onClick={() => handleApprove(order.id)} 
                disabled={processing === order.id}
                className="w-full"
              >
                {processing === order.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Approve Delivery
              </Button>

              <div className="pt-4 border-t space-y-2">
                <textarea
                  placeholder="Rejection reason..."
                  value={rejectNote[order.id] || ""}
                  onChange={(e) => setRejectNote({ ...rejectNote, [order.id]: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button 
                  variant="destructive"
                  onClick={() => handleReject(order.id)} 
                  disabled={processing === order.id || !(rejectNote[order.id]?.trim())}
                  className="w-full"
                >
                  {processing === order.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                  Reject Delivery
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
