"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import {
  creatorProfileSchema,
  payoutAccountSchema,
  type CreatorProfileInput,
  type PayoutAccountInput,
} from "@/lib/validation/profile";
import { updateCreatorProfile, savePayoutAccount } from "@/lib/actions/creator";
import type { Niche } from "@/lib/data/lookups";

interface ProfileFormProps {
  profile?: {
    bio?: string | null;
    niche_id?: string | null;
    years_experience?: number | null;
    rating_avg?: number | null;
    rating_count?: number | null;
  } | null;
  payoutAccount?: {
    method: "ccp" | "baridimob";
    account_holder_name: string;
    account_number: string;
  } | null;
  niches: Niche[];
}

export function CreatorProfileForm({
  profile,
  payoutAccount,
  niches,
}: ProfileFormProps) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [payoutMessage, setPayoutMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPayout, setIsSavingPayout] = useState(false);

  const {
    register: regProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<CreatorProfileInput>({
    resolver: zodResolver(creatorProfileSchema),
    defaultValues: {
      bio: profile?.bio ?? "",
      niche_id: profile?.niche_id ?? (niches[0]?.id || ""),
      years_experience: profile?.years_experience ?? 1,
    },
  });

  const {
    register: regPayout,
    handleSubmit: handlePayoutSubmit,
    formState: { errors: payoutErrors },
  } = useForm<PayoutAccountInput>({
    resolver: zodResolver(payoutAccountSchema),
    defaultValues: {
      method: payoutAccount?.method ?? "ccp",
      account_holder_name: payoutAccount?.account_holder_name ?? "",
      account_number: payoutAccount?.account_number ?? "",
    },
  });

  async function onSaveProfile(data: CreatorProfileInput) {
    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      const res = await updateCreatorProfile(data);
      if (res.success) {
        setProfileMessage({ type: "success", text: t("profileSaved") });
      } else {
        setProfileMessage({ type: "error", text: res.error || t("saveFailed") });
      }
    } catch (err: any) {
      setProfileMessage({ type: "error", text: err.message || t("saveFailed") });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function onSavePayout(data: PayoutAccountInput) {
    setIsSavingPayout(true);
    setPayoutMessage(null);
    try {
      const res = await savePayoutAccount(data);
      if (res.success) {
        setPayoutMessage({ type: "success", text: t("payoutSaved") });
      } else {
        setPayoutMessage({ type: "error", text: res.error || t("saveFailed") });
      }
    } catch (err: any) {
      setPayoutMessage({ type: "error", text: err.message || t("saveFailed") });
    } finally {
      setIsSavingPayout(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Profile Section */}
      <form
        onSubmit={handleProfileSubmit(onSaveProfile)}
        className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-start">{t("title")}</h2>
          {profile?.rating_count ? (
            <span className="flex items-center gap-1.5 text-xs bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-200 text-amber-600 font-semibold">
              ★ {Number(profile.rating_avg).toFixed(1)} ({profile.rating_count})
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("noReviewsYet")}</span>
          )}
        </div>

        {profileMessage && (
          <div
            className={`p-3 rounded-lg text-sm font-medium ${
              profileMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {profileMessage.text}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("nicheLabel")}</label>
          <select
            {...regProfile("niche_id")}
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
          {profileErrors.niche_id && (
            <p className="text-xs text-destructive text-start">{t("errors.nicheRequired")}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("bioLabel")}</label>
          <textarea
            {...regProfile("bio")}
            rows={4}
            placeholder={t("bioPlaceholder")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          {profileErrors.bio && (
            <p className="text-xs text-destructive text-start">{profileErrors.bio.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("experienceLabel")}</label>
          <input
            type="number"
            {...regProfile("years_experience", { valueAsNumber: true })}
            min={0}
            max={60}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSavingProfile}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSavingProfile ? t("saving") : t("saveProfile")}
          </button>
        </div>
      </form>

      {/* Payout Details Section */}
      <form
        onSubmit={handlePayoutSubmit(onSavePayout)}
        className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-5"
      >
        <div>
          <h2 className="text-xl font-bold text-start">{t("payoutTitle")}</h2>
          <p className="text-sm text-muted-foreground text-start mt-1">
            {t("payoutSubtitle")}
          </p>
        </div>

        {payoutMessage && (
          <div
            className={`p-3 rounded-lg text-sm font-medium ${
              payoutMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {payoutMessage.text}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("methodLabel")}</label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 rounded-lg border border-input p-3 cursor-pointer hover:bg-accent/50">
              <input
                type="radio"
                value="ccp"
                {...regPayout("method")}
                className="accent-primary"
              />
              <span className="text-sm font-medium">CCP</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-input p-3 cursor-pointer hover:bg-accent/50">
              <input
                type="radio"
                value="baridimob"
                {...regPayout("method")}
                className="accent-primary"
              />
              <span className="text-sm font-medium">BaridiMob</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("accountHolder")}</label>
          <input
            type="text"
            {...regPayout("account_holder_name")}
            placeholder={t("accountHolderPlaceholder")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {payoutErrors.account_holder_name && (
            <p className="text-xs text-destructive text-start">{t("errors.required")}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-start">{t("accountNumber")}</label>
          <input
            type="text"
            {...regPayout("account_number")}
            placeholder={t("accountNumberPlaceholder")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {payoutErrors.account_number && (
            <p className="text-xs text-destructive text-start">
              {payoutErrors.account_number.message === "digits_only"
                ? t("errors.digitsOnly")
                : t("errors.required")}
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSavingPayout}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSavingPayout ? t("saving") : t("savePayout")}
          </button>
        </div>
      </form>
    </div>
  );
}
