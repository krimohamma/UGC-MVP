"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { portfolioItemSchema, type PortfolioItemInput } from "@/lib/validation/portfolio";
import { addPortfolioItem, deletePortfolioItem } from "@/lib/actions/creator";
import type { PortfolioItem } from "@/lib/data/creator";

interface PortfolioManagerProps {
  userId: string;
  items: PortfolioItem[];
}

export function PortfolioManager({ userId, items }: PortfolioManagerProps) {
  const t = useTranslations("portfolio");
  const [sourceMode, setSourceMode] = useState<"upload" | "external">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PortfolioItemInput>({
    resolver: zodResolver(portfolioItemSchema),
    defaultValues: {
      title: "",
      video_url: "",
      thumbnail_url: "",
      external_url: "",
    },
  });

  function handleModeChange(mode: "upload" | "external") {
    setSourceMode(mode);
    setErrorMsg(null);
    if (mode === "upload") {
      setValue("external_url", "");
    } else {
      setValue("video_url", "");
      setValue("thumbnail_url", "");
      setSelectedFile(null);
    }
  }

  async function onSubmit(data: PortfolioItemInput) {
    setErrorMsg(null);
    setIsUploading(true);

    try {
      let videoUrl = data.video_url || "";

      // If upload mode and a file was picked, upload to Supabase storage `portfolio/{userId}/...`
      if (sourceMode === "upload" && selectedFile) {
        const supabase = createClient();
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { data: uploadResult, error: uploadErr } = await supabase.storage
          .from("portfolio")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadErr) {
          throw new Error(uploadErr.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("portfolio")
          .getPublicUrl(uploadResult.path);

        videoUrl = publicUrlData.publicUrl;
      }

      const payload: PortfolioItemInput = {
        title: data.title,
        video_url: sourceMode === "upload" ? videoUrl : undefined,
        external_url: sourceMode === "external" ? data.external_url : undefined,
      };

      const res = await addPortfolioItem(payload);
      if (res.success) {
        reset();
        setSelectedFile(null);
      } else {
        setErrorMsg(res.error || t("addFailed"));
      }
    } catch (err: any) {
      setErrorMsg(err.message || t("addFailed"));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    setDeletingId(id);
    try {
      await deletePortfolioItem(id);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Add New Item Card */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-5"
      >
        <div>
          <h2 className="text-xl font-bold text-start">{t("addTitle")}</h2>
          <p className="text-sm text-muted-foreground text-start mt-1">
            {t("addSubtitle")}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg text-sm font-medium bg-destructive/10 text-destructive">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("itemTitle")}</label>
          <input
            type="text"
            {...register("title")}
            placeholder={t("itemTitlePlaceholder")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Either/Or Toggle */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("sourceType")}</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleModeChange("upload")}
              className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                sourceMode === "upload"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background hover:bg-accent/50"
              }`}
            >
              {t("uploadVideo")}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("external")}
              className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                sourceMode === "external"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background hover:bg-accent/50"
              }`}
            >
              {t("externalLink")}
            </button>
          </div>
        </div>

        {/* Source Inputs */}
        {sourceMode === "upload" ? (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-start">{t("selectVideoFile")}</label>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-muted-foreground file:ms-0 file:me-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
            />
            <p className="text-xs text-muted-foreground text-start">
              {t("uploadLimitNotice")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-start">{t("linkUrl")}</label>
            <input
              type="url"
              {...register("external_url")}
              placeholder="https://www.tiktok.com/@user/video/..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.external_url && (
              <p className="text-xs text-destructive text-start">
                {t("errors.validUrlRequired")}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isUploading}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isUploading ? t("adding") : t("addItem")}
          </button>
        </div>
      </form>

      {/* Item List Grid */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-start">{t("yourPortfolio")} ({items.length})</h3>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
            {t("emptyPortfolio")}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col justify-between"
              >
                <div className="p-4 flex flex-col gap-2">
                  <h4 className="font-semibold text-sm line-clamp-1 text-start">
                    {item.title || t("untitledItem")}
                  </h4>
                  {item.external_url ? (
                    <a
                      href={item.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline truncate text-start block"
                    >
                      {item.external_url}
                    </a>
                  ) : item.video_url ? (
                    <video
                      src={item.video_url}
                      controls
                      className="w-full aspect-video rounded-md bg-black object-cover"
                    />
                  ) : null}
                </div>
                <div className="p-3 bg-muted/40 border-t border-border flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">
                    {item.external_url ? t("externalBadge") : t("uploadBadge")}
                  </span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="text-destructive hover:underline font-medium disabled:opacity-50"
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
