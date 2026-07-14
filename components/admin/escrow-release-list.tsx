"use client";

import { useState } from "react";
import { confirmEscrowRelease } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign } from "lucide-react";

export function EscrowReleaseList({ transactions }: { transactions: any[] }) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRelease = async (transactionId: string) => {
    setProcessing(transactionId);
    setError(null);
    const res = await confirmEscrowRelease(transactionId);
    if (!res.success) {
      setError(res.error || "Failed to release escrow");
    }
    setProcessing(null);
  };

  if (!transactions || transactions.length === 0) {
    return <div className="p-8 text-center text-muted-foreground border rounded-lg bg-background">No pending releases.</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
          {error}
        </div>
      )}

      {transactions.map((tx) => (
        <div key={tx.id} className="p-6 border rounded-lg bg-background shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-lg">{tx.amount_dzd.toLocaleString()} DZD</span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Escrow Release</span>
            </div>
            <p className="font-medium">{tx.orders?.gigs?.title}</p>
            <p className="text-sm text-muted-foreground font-mono mt-1">Transaction ID: {tx.id}</p>
            <p className="text-sm text-muted-foreground font-mono">Order ID: {tx.orders?.id}</p>
          </div>

          <div className="flex-shrink-0 w-full md:w-auto">
            <Button 
              onClick={() => handleRelease(tx.id)} 
              disabled={processing === tx.id}
              className="w-full md:w-auto"
            >
              {processing === tx.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
              Release Funds to Creator
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
