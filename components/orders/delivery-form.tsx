"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { deliverOrder } from "@/lib/actions/fulfillment";
import { Database } from "@/lib/database.types";
import { Upload, FileVideo, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Order = Database["public"]["Tables"]["orders"]["Row"];

export function DeliveryForm({ order }: { order: Order }) {
  const t = useTranslations("workspace");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleDeliver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // 1. Upload to Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${order.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("deliverables")
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // `deliverables` is a private bucket (unlike `portfolio`) — store the
      // raw object path, not a public URL (which wouldn't be servable at
      // all). Readers get a short-lived signed URL instead; see
      // app/[locale]/(dashboard)/dashboard/orders/[orderId]/page.tsx and
      // app/[locale]/(admin)/admin/deliveries/page.tsx.
      const res = await deliverOrder({
        orderId: order.id,
        fileUrl: filePath,
        fileType: file.type.startsWith("video/") ? "video" : "other",
        note: note.trim() || undefined,
      });

      if (res.error) {
        throw new Error(res.error);
      }

    } catch (err: any) {
      setError(err.message || t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 border border-primary/20 rounded-lg bg-primary/5">
      <h3 className="font-semibold mb-4">{t("deliverWork")}</h3>
      
      <form onSubmit={handleDeliver} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        <div className="grid w-full max-w-sm items-center gap-1.5">
          <label htmlFor="deliverable-file" className="text-sm font-medium">
            {t("uploadVideo")}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="deliverable-file"
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById("deliverable-file")?.click()}
            >
              <Upload className="w-4 h-4 me-2" />
              {file ? t("changeFile") : t("selectFile")}
            </Button>
            {file && (
              <span className="text-sm text-muted-foreground flex items-center">
                <FileVideo className="w-4 h-4 me-1" />
                {file.name}
              </span>
            )}
          </div>
        </div>

        <div className="grid w-full gap-1.5">
          <label htmlFor="deliverable-note" className="text-sm font-medium">
            {t("noteOptional")}
          </label>
          <textarea
            id="deliverable-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <Button type="submit" disabled={!file || uploading} className="w-full">
          {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("submitDelivery")}
        </Button>
      </form>
    </div>
  );
}
