"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatDzd } from "@/lib/format";
import { submitPaymentProof } from "@/lib/actions/order";

interface PaymentProofFormProps {
  order: any;
  locale: string;
}

export function PaymentProofForm({ order, locale }: PaymentProofFormProps) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<"ccp" | "baridimob">("ccp");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!file) {
      setError(t("fileRequiredError") || "Receipt file is required");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append("orderId", order.id);
    formData.append("paymentMethod", paymentMethod);
    if (referenceNumber) {
      formData.append("referenceNumber", referenceNumber);
    }
    formData.append("proofFile", file);

    const result = await submitPaymentProof(formData);

    if (!result.success) {
      setError(result.error || "Failed to submit payment proof");
      setIsSubmitting(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-8 py-8 px-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-start">
          {t("paymentTitle")}
        </h1>
        <p className="text-muted-foreground text-start">
          {t("paymentSubtitle")}
        </p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-sm flex flex-col gap-4 text-start">
        <h2 className="text-lg font-bold text-primary">{t("amountToPay")}</h2>
        <span className="text-4xl font-extrabold font-mono text-primary tracking-tight">
          {formatDzd(order.price_dzd, locale as any)}
        </span>
      </div>

      {/* Platform Bank Details (Hardcoded for prototype) */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4 text-start">
        <h3 className="font-bold text-base border-b border-border pb-2">{t("platformAccountDetails")}</h3>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
            <span className="text-muted-foreground font-semibold">CCP:</span>
            <span className="font-mono font-bold tracking-widest">0000 123456 78</span>
          </div>
          <div className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
            <span className="text-muted-foreground font-semibold">BaridiMob RIP:</span>
            <span className="font-mono font-bold tracking-widest">007 99999 0000000123 45</span>
          </div>
          <div className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
            <span className="text-muted-foreground font-semibold">{t("accountName")}:</span>
            <span className="font-bold">UGC Platform Algérie</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-6 text-start">
        <div className="flex flex-col gap-3">
          <label className="text-sm font-bold">{t("paymentMethod")}</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="ccp"
                checked={paymentMethod === "ccp"}
                onChange={() => setPaymentMethod("ccp")}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm font-semibold">CCP (Poste)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="baridimob"
                checked={paymentMethod === "baridimob"}
                onChange={() => setPaymentMethod("baridimob")}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm font-semibold">BaridiMob</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="reference" className="text-sm font-bold">
            {t("referenceNumber")} <span className="text-muted-foreground font-normal">({t("optional")})</span>
          </label>
          <input
            type="text"
            id="reference"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm font-mono"
            placeholder="123456789"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="receipt" className="text-sm font-bold">
            {t("uploadReceipt")}
          </label>
          <input
            type="file"
            id="receipt"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer border border-input bg-background p-2 rounded-lg"
          />
        </div>

        {error && (
          <div className="text-sm text-destructive font-semibold bg-destructive/10 p-3 rounded-lg text-start">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !file}
          className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold shadow-sm disabled:opacity-50 transition-opacity hover:opacity-90 mt-2"
        >
          {isSubmitting ? t("processing") : t("submitPayment")}
        </button>
      </form>
    </div>
  );
}
