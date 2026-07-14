"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { gigSchema, type GigInput } from "@/lib/validation/gig";
import { createGig, updateGig } from "@/lib/actions/gig";
import type { Niche, Language } from "@/lib/data/lookups";

interface GigFormProps {
  userId: string;
  niches: Niche[];
  languages: Language[];
  initialData?: {
    id: string;
    title: string;
    description: string;
    niche_id: string;
    status: "draft" | "active" | "paused" | "archived";
    cover_media_url?: string | null;
    language_codes: string[];
    packages: {
      tier: "basic" | "standard" | "premium";
      title: string;
      description: string;
      price_dzd: number;
      delivery_days: number;
      revisions_included: number;
      features: string[];
    }[];
  };
}

export function GigForm({
  userId,
  niches,
  languages,
  initialData,
}: GigFormProps) {
  const t = useTranslations("gigForm");
  const locale = useLocale();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);

  const defaultPackages = initialData?.packages || [
    {
      tier: "basic" as const,
      title: "Essentiel",
      description: "1 vidéo UGC 30s format vertical",
      price_dzd: 4000,
      delivery_days: 3,
      revisions_included: 1,
      features: ["1 vidéo 30s", "Format 9:16"],
    },
    {
      tier: "standard" as const,
      title: "Standard",
      description: "1 vidéo UGC 60s avec sous-titres",
      price_dzd: 7000,
      delivery_days: 5,
      revisions_included: 2,
      features: ["1 vidéo 60s", "Format 9:16", "Sous-titres intégrés"],
    },
    {
      tier: "premium" as const,
      title: "Premium",
      description: "2 vidéos UGC avec montage avancé",
      price_dzd: 12000,
      delivery_days: 7,
      revisions_included: 3,
      features: ["2 vidéos", "Format 9:16", "Sous-titres & musique"],
    },
  ];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GigInput>({
    resolver: zodResolver(gigSchema),
    defaultValues: {
      title: initialData?.title ?? "",
      description: initialData?.description ?? "",
      niche_id: initialData?.niche_id ?? niches[0]?.id,
      status: initialData?.status ?? "active",
      cover_media_url: initialData?.cover_media_url ?? "",
      language_codes: initialData?.language_codes ?? ["fr"],
      packages: defaultPackages,
    },
  });

  const selectedLangs = watch("language_codes");

  function handleLanguageToggle(code: string) {
    const current = selectedLangs || [];
    if (current.includes(code)) {
      setValue(
        "language_codes",
        current.filter((c) => c !== code)
      );
    } else {
      setValue("language_codes", [...current, code]);
    }
  }

  async function onSubmit(data: GigInput) {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let coverUrl = data.cover_media_url || "";

      // Upload cover file if selected
      if (selectedCoverFile) {
        const supabase = createClient();
        const fileExt = selectedCoverFile.name.split(".").pop();
        const fileName = `cover_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("portfolio")
          .upload(filePath, selectedCoverFile, { upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from("portfolio")
          .getPublicUrl(uploadData.path);

        coverUrl = publicUrlData.publicUrl;
      }

      const payload: GigInput = {
        ...data,
        cover_media_url: coverUrl,
      };

      let res;
      if (initialData?.id) {
        res = await updateGig(initialData.id, payload);
      } else {
        res = await createGig(payload);
      }

      if (res.success) {
        router.push("/dashboard");
      } else {
        setErrorMessage(res.error || t("submitFailed"));
      }
    } catch (err: any) {
      setErrorMessage(err.message || t("submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-4xl flex flex-col gap-8 pb-12"
    >
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-start">
          {initialData ? t("editGigTitle") : t("createGigTitle")}
        </h1>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl text-sm font-medium bg-destructive/10 text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Main Details */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-start border-b border-border pb-3">
          {t("generalSection")}
        </h2>

        {/* Title */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("titleLabel")}</label>
          <input
            type="text"
            {...register("title")}
            placeholder={t("titlePlaceholder")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.title && (
            <p className="text-xs text-destructive text-start">{errors.title.message}</p>
          )}
        </div>

        {/* Niche */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("nicheLabel")}</label>
          <select
            {...register("niche_id")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {niches.map((niche) => {
              const name =
                locale === "ar"
                  ? niche.name_ar
                  : locale === "en"
                  ? niche.name_en
                  : niche.name_fr;
              return (
                <option key={niche.id} value={niche.id}>
                  {name}
                </option>
              );
            })}
          </select>
          {errors.niche_id && (
            <p className="text-xs text-destructive text-start">{errors.niche_id.message}</p>
          )}
        </div>

        {/* Content Languages */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("languagesLabel")}</label>
          <div className="flex flex-wrap gap-2 pt-1">
            {languages.map((lang) => {
              const name =
                locale === "ar"
                  ? lang.name_ar
                  : locale === "en"
                  ? lang.name_en
                  : lang.name_fr;
              const isSelected = selectedLangs?.includes(lang.code);
              return (
                <button
                  type="button"
                  key={lang.code}
                  onClick={() => handleLanguageToggle(lang.code)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent/50 text-foreground"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          {errors.language_codes && (
            <p className="text-xs text-destructive text-start">
              {t("errors.languageRequired")}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("descriptionLabel")}</label>
          <textarea
            {...register("description")}
            rows={5}
            placeholder={t("descriptionPlaceholder")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.description && (
            <p className="text-xs text-destructive text-start">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Cover Media */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("coverLabel")}</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSelectedCoverFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-muted-foreground file:me-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
          />
        </div>

        {/* Status */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("statusLabel")}</label>
          <select
            {...register("status")}
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-start text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="draft">{t("statusDraft")}</option>
            <option value="active">{t("statusActive")}</option>
            <option value="paused">{t("statusPaused")}</option>
          </select>
        </div>
      </div>

      {/* Packages Section (3 Tiers: Basic, Standard, Premium) */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold text-start border-b border-border pb-3">
            {t("packagesSection")}
          </h2>
          <p className="text-xs text-muted-foreground text-start mt-1">
            {t("packagesNotice")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((index) => {
            const tierNames = ["Basic", "Standard", "Premium"];
            const tierBadgeColors = [
              "bg-blue-500/10 text-blue-600 border-blue-200",
              "bg-purple-500/10 text-purple-600 border-purple-200",
              "bg-amber-500/10 text-amber-600 border-amber-200",
            ];

            return (
              <div
                key={index}
                className="rounded-xl border border-border bg-background p-4 flex flex-col gap-4 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-bold border ${tierBadgeColors[index]}`}
                  >
                    {tierNames[index]}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-start">{t("pkgTitle")}</label>
                  <input
                    type="text"
                    {...register(`packages.${index}.title` as const)}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-start"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-start">{t("pkgDesc")}</label>
                  <textarea
                    rows={2}
                    {...register(`packages.${index}.description` as const)}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-start resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-start">{t("priceDzd")}</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      {...register(`packages.${index}.price_dzd` as const, {
                        valueAsNumber: true,
                      })}
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 pe-12 text-xs text-start font-mono font-bold"
                    />
                    <span className="absolute end-2.5 top-1.5 text-xs font-bold text-muted-foreground">
                      DZD
                    </span>
                  </div>
                  {errors.packages?.[index]?.price_dzd && (
                    <p className="text-[10px] text-destructive text-start">
                      {t("errors.noDecimalsAllowed")}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-start">
                      {t("deliveryDays")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      {...register(`packages.${index}.delivery_days` as const, {
                        valueAsNumber: true,
                      })}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-start"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-start">
                      {t("revisions")}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      {...register(`packages.${index}.revisions_included` as const, {
                        valueAsNumber: true,
                      })}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-start"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-lg border border-input px-5 py-2.5 text-sm font-semibold hover:bg-accent"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? t("saving") : t("saveGig")}
        </button>
      </div>
    </form>
  );
}
