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

/**
 * Same convention as logMoneyEvent, for the email-link confirmation flow
 * (app/auth/confirm/route.ts). Added after a production incident where
 * verifyOtp failures were indistinguishable from each other in the redirect
 * alone (expired vs. already-used vs. wrong type) — grep `AUTH_EVENT` in
 * Vercel's log viewer.
 *
 * `confirmRender` (GET, never calls verifyOtp) and `confirmRedeem` (POST,
 * the only place verifyOtp is called) are logged separately so an email
 * scanner's prefetch (a GET with no matching POST) is visible in the logs
 * as distinct from a real user completing the flow — never log `token_hash`
 * itself, only whether the expected params were present.
 */
export function logAuthEvent(event: {
  action: "confirmRender" | "confirmRedeem" | "signupProfileInsert";
  outcome: "success" | "failure";
  otpType?: string;
  next?: string;
  hasTokenHash?: boolean;
  userAgent?: string;
  error?: string;
  errorCode?: string;
}) {
  console.log(
    JSON.stringify({
      tag: "AUTH_EVENT",
      timestamp: new Date().toISOString(),
      ...event,
    }),
  );
}
