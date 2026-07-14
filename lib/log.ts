/**
 * Structured logging for money-moving server actions — greppable in Vercel's
 * log viewer via the fixed `MONEY_EVENT` tag (`grep MONEY_EVENT` or the
 * equivalent search in the Vercel dashboard). One line per outcome, JSON so
 * it's machine-parseable too. Not a metrics/tracing system — just the floor
 * needed to answer "did this money-moving action succeed, and for which
 * order/payout?" from logs alone.
 */
export function logMoneyEvent(event: {
  action: string; // e.g. "createOrder", "submitPaymentProof", "confirmEscrowHold",
  //      "confirmEscrowRelease", "processPayout", "acceptDelivery"
  outcome: "success" | "failure";
  orderId?: string;
  payoutId?: string;
  transactionId?: string;
  amountDzd?: number;
  actorId?: string;
  error?: string;
}) {
  console.log(
    JSON.stringify({
      tag: "MONEY_EVENT",
      timestamp: new Date().toISOString(),
      ...event,
    }),
  );
}
