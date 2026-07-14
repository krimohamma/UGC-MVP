"use client";

import { useState } from "react";
import { formatDzd } from "@/lib/format";
import { confirmEscrowHold } from "@/lib/actions/admin";

interface TransactionListProps {
  transactions: any[];
  locale: string;
}

export function TransactionList({ transactions, locale }: TransactionListProps) {
  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(id: string) {
    setIsConfirming(id);
    setError(null);

    const result = await confirmEscrowHold(id);

    if (!result.success) {
      setError(result.error || "Failed to confirm transaction");
    }
    
    setIsConfirming(null);
  }

  if (transactions.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl bg-card">
        No pending transactions requiring verification.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm font-bold text-start">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm text-start">
          <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
            <tr>
              <th className="px-4 py-3 text-start">Order ID</th>
              <th className="px-4 py-3 text-start">Brand (User ID)</th>
              <th className="px-4 py-3 text-start">Amount</th>
              <th className="px-4 py-3 text-start">Method</th>
              <th className="px-4 py-3 text-start">Reference</th>
              <th className="px-4 py-3 text-start">Receipt</th>
              <th className="px-4 py-3 text-end">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{tx.order_id?.substring(0, 8)}...</td>
                <td className="px-4 py-3 text-xs">{tx.orders?.brand_id?.substring(0, 8)}...</td>
                <td className="px-4 py-3 font-mono font-bold text-primary">
                  {formatDzd(tx.amount_dzd, locale as any)}
                </td>
                <td className="px-4 py-3 uppercase font-semibold">{tx.payment_method}</td>
                <td className="px-4 py-3 font-mono text-xs">{tx.reference_number || "-"}</td>
                <td className="px-4 py-3">
                  {tx.proof_image_url ? (
                    // `receipts` is a private bucket; the page already
                    // resolved this to a short-lived signed URL before
                    // passing it down — use it as-is (previously this
                    // rebuilt a "public" object URL around the signed URL,
                    // which can never resolve for a private bucket).
                    <a
                      href={tx.proof_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs font-semibold"
                    >
                      View Receipt
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">No file</span>
                  )}
                </td>
                <td className="px-4 py-3 text-end">
                  <button
                    onClick={() => handleConfirm(tx.id)}
                    disabled={isConfirming === tx.id}
                    className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold shadow-sm disabled:opacity-50"
                  >
                    {isConfirming === tx.id ? "Confirming..." : "Confirm Payment"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
