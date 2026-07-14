"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { reviewDelivery } from "@/lib/actions/fulfillment";
import { Database } from "@/lib/database.types";
import { Loader2, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type Deliverable = Database["public"]["Tables"]["order_deliverables"]["Row"];

export function ReviewDelivery({ order, deliverable }: { order: Order; deliverable: Deliverable }) {
  const t = useTranslations("workspace");
  const [action, setAction] = useState<"accept" | "revise" | "dispute" | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxRevisions = order.revisions_included;
  const usedRevisions = order.revisions_used;
  const canRevise = usedRevisions < maxRevisions;

  const handleSubmit = async () => {
    if (!action) return;
    if ((action === "revise" || action === "dispute") && !note.trim()) {
      setError(t("reasonRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await reviewDelivery({
      orderId: order.id,
      action,
      note: note.trim() || undefined,
    });

    if (res.error) {
      setError(res.error);
    }
    
    setSubmitting(false);
  };

  return (
    <div className="p-4 border border-primary/20 rounded-lg bg-background">
      <h3 className="font-semibold mb-4">{t("reviewDelivery")}</h3>
      
      <div className="mb-6 aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
        <video controls className="w-full h-full" src={deliverable.file_url}>
          Your browser does not support the video tag.
        </video>
      </div>

      {deliverable.note && (
        <div className="mb-6 p-3 bg-muted rounded-md text-sm">
          <span className="font-semibold">{t("creatorNote")}:</span> {deliverable.note}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <Button 
          variant={action === "accept" ? "default" : "outline"}
          onClick={() => { setAction("accept"); setError(null); }}
        >
          <CheckCircle className="w-4 h-4 me-2" />
          {t("accept")}
        </Button>

        <Button 
          variant={action === "revise" ? "default" : "outline"}
          disabled={!canRevise}
          onClick={() => { setAction("revise"); setError(null); }}
        >
          <RefreshCw className="w-4 h-4 me-2" />
          {t("requestRevision")} ({usedRevisions}/{maxRevisions})
        </Button>

        <Button 
          variant={action === "dispute" ? "destructive" : "outline"}
          onClick={() => { setAction("dispute"); setError(null); }}
        >
          <AlertTriangle className="w-4 h-4 me-2" />
          {t("dispute")}
        </Button>
      </div>

      {(action === "revise" || action === "dispute") && (
        <div className="mb-4">
          <label className="text-sm font-medium mb-1 block">
            {action === "revise" ? t("revisionReason") : t("disputeReason")}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={t("reasonPlaceholder")}
          />
        </div>
      )}

      {action && (
        <Button 
          className="w-full" 
          onClick={handleSubmit} 
          disabled={submitting}
          variant={action === "dispute" ? "destructive" : "default"}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("confirmAction")}
        </Button>
      )}
    </div>
  );
}
