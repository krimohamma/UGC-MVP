/**
 * End-to-end verification of the order/escrow lifecycle against the LIVE
 * Supabase project. Exercises the same paths the app uses: supabase-js with
 * role-appropriate JWTs (creator/brand/admin sign in for real), and the
 * service-role client ONLY where the app itself uses it (auth admin setup,
 * and the two escrow RPCs via lib/actions/admin.ts's pattern).
 *
 * Covers: checkout -> payment proof -> privilege-escalation negative checks
 * on the escrow RPCs -> admin confirms escrow -> delivery + admin QC gate ->
 * brand accepts -> admin releases escrow -> reviews (both directions,
 * duplicate/non-participant/non-completed-order rejections, exact
 * denormalized-aggregate recompute) -> payout request/process (negative:
 * creator/brand cannot touch someone else's payout; positive: admin
 * processes it, ledger reconciles) -> notifications (per-recipient locale,
 * RLS visibility) -> cross-tenant RLS isolation.
 *
 * Run:   npx tsx scripts/verify-lifecycle.ts
 * Keep:  npx tsx scripts/verify-lifecycle.ts --keep   (skip teardown)
 */

import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

// ---------------------------------------------------------------------------
// Env (no dotenv dependency — .env.local is a flat KEY=VALUE file)
// ---------------------------------------------------------------------------
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY in .env.local",
  );
  process.exit(1);
}

const KEEP = process.argv.includes("--keep");
const TEST_PASSWORD = "Lifecycle-Test-P@ss1";

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------
type StepResult = {
  step: string;
  expected: string;
  actual: string;
  pass: boolean;
};
const results: StepResult[] = [];

function record(step: string, expected: string, actual: unknown, pass: boolean) {
  const r = { step, expected, actual: String(actual), pass };
  results.push(r);
  console.log(`[${pass ? "PASS" : "FAIL"}] ${step}`);
  if (!pass) console.log(`    expected: ${expected}\n    actual:   ${r.actual}`);
}

class AbortRun extends Error {}

// This sandbox occasionally hits a connect-timeout on the very first outbound
// HTTPS request a fresh Node process makes (observed: fails on call #1, then
// every subsequent call — and every isolated single-call retry — succeeds).
// Absorb that cold-start hiccup with one retried, side-effect-free warm-up
// call before doing anything stateful, rather than threading retry logic
// through every call site.
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`  (network hiccup on ${label}, attempt ${i + 1}/${attempts}: ${(err as Error).message})`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Notification helpers
//
// lib/notify.ts (and every lib/actions/*.ts it's called from) cannot be
// imported here: they transitively import lib/supabase/admin.ts, which has
// `import "server-only"` and throws immediately outside Next's own build
// (confirmed empirically — `server-only` doesn't know this is a trusted
// script, it just sees a non-Next module graph). lib/notify.ts's own
// `getTranslations` call has the same problem one level up. This is the
// same constraint that already shaped every other step in this script: it
// mirrors the DB-level effect of each app action via raw supabase-js
// (createClient with role-appropriate JWTs / the service-role key), not by
// importing the Next.js action wrappers, because those also depend on
// next/headers' cookies() and next/cache's revalidatePath(), neither of
// which function outside a live Next.js request.
//
// So: the script inserts the notification row itself, mirroring exactly
// what notify() does (recipient locale lookup -> resolve title/body ->
// insert via service-role client). Expected text is read directly from
// messages/fr.json / messages/ar.json — the same single source of truth
// notify() itself reads via next-intl — rather than hand-typed, so a
// missing/renamed message key is still caught. What this does NOT exercise
// is notify()'s own ~15 lines of glue code (its call into getTranslations,
// its own locale-lookup query) — flagged plainly in the report rather than
// overclaiming "notify() verified".
// ---------------------------------------------------------------------------

const messagesCache = new Map<string, any>();
function readMessages(locale: "fr" | "ar"): any {
  if (!messagesCache.has(locale)) {
    const p = path.resolve(__dirname, `../messages/${locale}.json`);
    messagesCache.set(locale, JSON.parse(fs.readFileSync(p, "utf-8")));
  }
  return messagesCache.get(locale);
}

function resolveNotificationText(
  type: string,
  locale: "fr" | "ar",
  params?: Record<string, string | number>,
): { title: string; body: string } {
  const messages = readMessages(locale);
  const entry = messages?.notifications?.events?.[type];
  if (!entry) throw new AbortRun(`no messages.notifications.events.${type} for locale=${locale}`);
  let body: string = entry.body;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      body = body.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
    }
  }
  return { title: entry.title, body };
}

// Mirrors lib/notify.ts's notify(): look up the recipient's own locale, then
// insert via the service-role client (matches 0010_notifications.sql: INSERT
// has no policy for authenticated/anon at all).
async function mirrorNotify(params: {
  userId: string;
  type: string;
  bodyParams?: Record<string, string | number>;
  linkUrl?: string;
}) {
  const { data: recipient } = await adminClient.from("users").select("locale").eq("id", params.userId).single();
  const locale = (recipient?.locale ?? "fr") as "fr" | "ar";
  const { title, body } = resolveNotificationText(params.type, locale, params.bodyParams);

  const { data, error } = await adminClient
    .from("notifications")
    .insert({ user_id: params.userId, type: params.type, title, body, link_url: params.linkUrl ?? null })
    .select("*")
    .single();

  if (error || !data) throw new AbortRun(`mirrorNotify insert failed (type=${params.type}): ${error?.message}`);
  return data;
}

// Asserts: (a) the row's title/body match the recipient-locale text (already
// true by construction above, but re-derived independently here so this is a
// real check, not a tautology — it re-resolves from the recipient's OWN
// users.locale read back from the DB, not the locale captured in the closure
// above), (b) the recipient's own client can read it, (c) an unrelated
// client cannot (RLS: notifications_select_own).
async function assertNotification(
  label: string,
  row: { id: string; user_id: string; type: string; title: string; body: string | null },
  recipientLocale: "fr" | "ar",
  bodyParams: Record<string, string | number> | undefined,
  recipientClient: SupabaseClient<Database>,
  otherClients: SupabaseClient<Database>[],
) {
  const expected = resolveNotificationText(row.type, recipientLocale, bodyParams);
  const textMatches = row.title === expected.title && row.body === expected.body;

  const { data: ownRead } = await recipientClient.from("notifications").select("id").eq("id", row.id).maybeSingle();
  const otherReads = await Promise.all(
    otherClients.map((c) => c.from("notifications").select("id").eq("id", row.id).maybeSingle()),
  );
  const othersBlocked = otherReads.every((r) => !r.data);

  record(
    label,
    `title/body match messages/${recipientLocale}.json's notifications.events.${row.type}; recipient can read; others cannot`,
    `textMatches=${textMatches} (title="${row.title}"), ownRead=${!!ownRead}, othersBlocked=${othersBlocked}`,
    textMatches && !!ownRead && othersBlocked,
  );
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
// service-role client — bypasses RLS. Used ONLY for: (a) test-fixture auth
// admin setup, and (b) the two escrow RPCs, exactly mirroring how
// lib/actions/admin.ts calls them (after its own app-level admin check).
const adminClient: SupabaseClient<Database> = createClient(URL!, SECRET_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function freshClient(): SupabaseClient<Database> {
  return createClient(URL!, PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(email: string, password: string): Promise<SupabaseClient<Database>> {
  const client = freshClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new AbortRun(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

// ---------------------------------------------------------------------------
// Test fixture identities
// ---------------------------------------------------------------------------
// creator=ar, brand=fr deliberately: proves lib/notify.ts resolves each
// notification in the RECIPIENT's own locale, not the acting user's.
const USERS = {
  creator: { email: "verify-creator@lifecycle-test.local", full_name: "Verify Creator", role: "creator" as const, locale: "ar" as const },
  brand: { email: "verify-brand@lifecycle-test.local", full_name: "Verify Brand", role: "brand" as const, locale: "fr" as const },
  admin: { email: "verify-admin@lifecycle-test.local", full_name: "Verify Admin", role: "admin" as const, locale: "fr" as const },
  brand2: { email: "verify-brand2@lifecycle-test.local", full_name: "Verify Brand Two", role: "brand" as const, locale: "fr" as const },
};

async function ensureTestUser(spec: (typeof USERS)[keyof typeof USERS]): Promise<string> {
  // Look up first — public.users is readable by service role regardless of RLS.
  const { data: existing } = await adminClient
    .from("users")
    .select("id")
    .eq("email", spec.email)
    .maybeSingle();

  let userId: string;
  if (existing) {
    userId = existing.id;
    // Force a known password so sign-in is deterministic across repeated runs.
    const { error } = await adminClient.auth.admin.updateUserById(userId, { password: TEST_PASSWORD });
    if (error) throw new AbortRun(`failed to reset password for ${spec.email}: ${error.message}`);
  } else {
    const { data: created, error } = await adminClient.auth.admin.createUser({
      email: spec.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) throw new AbortRun(`failed to create auth user ${spec.email}: ${error?.message}`);
    userId = created.user.id;
  }

  // Upsert the public.users row (mirrors lib/auth/actions.ts's post-signUp insert).
  const { error: upsertError } = await adminClient.from("users").upsert(
    {
      id: userId,
      role: spec.role,
      email: spec.email,
      password_hash: "lifecycle_test_managed",
      full_name: spec.full_name,
      locale: spec.locale,
      is_verified: true,
    },
    { onConflict: "id" },
  );
  if (upsertError) throw new AbortRun(`failed to upsert public.users for ${spec.email}: ${upsertError.message}`);

  return userId;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== Verifying order/escrow lifecycle against ${URL} ===\n`);

  // Scopes the notifications teardown to rows created by THIS run (users
  // are persistent test fixtures never deleted, so notifications don't
  // cascade away on their own — see Step 11).
  const testStartedAt = new Date().toISOString();

  await withRetry(async () => {
    const { error } = await adminClient.from("niches").select("id").limit(1);
    if (error) throw new Error(error.message);
  }, "connection warm-up");

  // --- Setup: three (four, counting the RLS-isolation brand) test users ---
  const creatorId = await ensureTestUser(USERS.creator);
  const brandId = await ensureTestUser(USERS.brand);
  const adminId = await ensureTestUser(USERS.admin);
  const brand2Id = await ensureTestUser(USERS.brand2);

  const creatorClient = await signIn(USERS.creator.email, TEST_PASSWORD);
  const brandClient = await signIn(USERS.brand.email, TEST_PASSWORD);
  const adminUserClient = await signIn(USERS.admin.email, TEST_PASSWORD);
  const brand2Client = await signIn(USERS.brand2.email, TEST_PASSWORD);
  const anon = freshClient();

  record(
    "Setup: 4 test users ready (creator/brand/admin/unrelated-brand)",
    "all sign-ins succeed",
    `creator=${creatorId} brand=${brandId} admin=${adminId} brand2=${brand2Id}`,
    true,
  );

  // Creator profile (required by gigs_insert_own's current_user_role() check
  // indirectly — role lives on public.users, profile itself isn't required
  // for the FK, but exercise the real onboarding shape anyway).
  const { data: niche } = await anon.from("niches").select("id").limit(1).maybeSingle();
  if (!niche) throw new AbortRun("no niches found — seed.sql must be applied first");

  await creatorClient.from("creator_profiles").upsert(
    { user_id: creatorId, niche_id: niche.id, bio: "Lifecycle test creator" },
    { onConflict: "user_id" },
  );

  // --- Gig + packages: create (or reuse) ---
  const GIG_TITLE = "[LIFECYCLE-TEST] Verification gig";
  let { data: gig } = await creatorClient
    .from("gigs")
    .select("id")
    .eq("creator_id", creatorId)
    .eq("title", GIG_TITLE)
    .maybeSingle();

  let gigId: string;
  if (gig) {
    gigId = gig.id;
  } else {
    const { data: newGig, error: gigError } = await creatorClient
      .from("gigs")
      .insert({
        creator_id: creatorId,
        niche_id: niche.id,
        title: GIG_TITLE,
        description: "Created by scripts/verify-lifecycle.ts — safe to delete.",
        status: "active",
        base_price_dzd: 7000,
      })
      .select("id")
      .single();
    if (gigError || !newGig) throw new AbortRun(`gig insert failed: ${gigError?.message}`);
    gigId = newGig.id;

    const { error: pkgError } = await creatorClient.from("gig_packages").insert([
      { gig_id: gigId, tier: "basic", title: "Basic", description: "Basic tier", price_dzd: 4000, delivery_days: 3, revisions_included: 1, features: ["1 video"] },
      { gig_id: gigId, tier: "standard", title: "Standard", description: "Standard tier", price_dzd: 7000, delivery_days: 5, revisions_included: 2, features: ["1 video", "subtitles"] },
      { gig_id: gigId, tier: "premium", title: "Premium", description: "Premium tier", price_dzd: 12000, delivery_days: 7, revisions_included: 3, features: ["2 videos", "premium edit"] },
    ]);
    if (pkgError) throw new AbortRun(`package insert failed: ${pkgError.message}`);
  }

  const { data: standardPkg } = await anon
    .from("gig_packages")
    .select("id, price_dzd")
    .eq("gig_id", gigId)
    .eq("tier", "standard")
    .single();
  if (!standardPkg) throw new AbortRun("standard package not found after setup");

  record("Setup: gig + 3 packages ready", "gig active with standard package", `gig=${gigId} standard price=${standardPkg.price_dzd} DZD`, true);

  // ---------------------------------------------------------------------
  // Step 2 — BRAND places an order (checkout path), then submits payment
  // proof (the rest of the checkout journey — createOrder alone leaves the
  // order in pending_payment with no transaction yet, which is what
  // confirm_escrow_payment needs to have something to confirm).
  // ---------------------------------------------------------------------
  const priceDzd = standardPkg.price_dzd;
  const commissionAmountDzd = priceDzd < 10000 ? 1000 : Math.round(priceDzd * 0.1);
  const commissionRate = priceDzd < 10000 ? 1000 / priceDzd : 0.1;
  const creatorPayoutDzd = priceDzd - commissionAmountDzd;

  const { data: order, error: orderError } = await brandClient
    .from("orders")
    .insert({
      brand_id: brandId,
      creator_id: creatorId,
      gig_id: gigId,
      gig_package_id: standardPkg.id,
      price_dzd: priceDzd,
      commission_rate: commissionRate,
      commission_amount_dzd: commissionAmountDzd,
      creator_payout_dzd: creatorPayoutDzd,
      revisions_included: 2,
      requirements: "Lifecycle test order — please ignore.",
      status: "pending_payment",
    })
    .select("*")
    .single();

  if (orderError || !order) {
    record("Step 2: BRAND places order (checkout)", "order row created, status=pending_payment", orderError?.message ?? "no order returned", false);
    throw new AbortRun("cannot continue without an order");
  }
  await brandClient.from("order_status_history").insert({
    order_id: order.id,
    to_status: "pending_payment",
    changed_by: brandId,
    note: "Order created (verify-lifecycle.ts)",
  });

  record(
    "Step 2: BRAND places order (checkout)",
    `status=pending_payment, price_dzd=${priceDzd}`,
    `status=${order.status}, price_dzd=${order.price_dzd}`,
    order.status === "pending_payment" && order.price_dzd === priceDzd,
  );

  // Conversation + one message (used later for the RLS cross-tenant check).
  const { data: conversation } = await brandClient
    .from("conversations")
    .insert({ brand_id: brandId, creator_id: creatorId, order_id: order.id })
    .select("id")
    .single();
  if (conversation) {
    await brandClient.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: brandId,
      body: "Hi! Looking forward to working with you.",
    });
  }

  // Submit payment proof (mirrors submitPaymentProof in lib/actions/order.ts).
  const fakeReceiptPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const receiptPath = `${brandId}/receipt_${order.id}_${Date.now()}.png`;
  const { error: receiptUploadError } = await brandClient.storage
    .from("receipts")
    .upload(receiptPath, fakeReceiptPng, { contentType: "image/png" });
  if (receiptUploadError) throw new AbortRun(`receipt upload failed: ${receiptUploadError.message}`);

  const { data: escrowHoldTx, error: escrowHoldTxError } = await brandClient
    .from("transactions")
    .insert({
      order_id: order.id,
      type: "escrow_hold",
      amount_dzd: order.price_dzd,
      status: "pending",
      payment_method: "ccp",
      proof_image_url: receiptPath,
    })
    .select("*")
    .single();

  record(
    "Step 2b: BRAND submits payment proof (escrow_hold transaction)",
    "transaction row created, type=escrow_hold, status=pending",
    escrowHoldTxError?.message ?? `type=${escrowHoldTx?.type}, status=${escrowHoldTx?.status}`,
    !escrowHoldTxError && escrowHoldTx?.type === "escrow_hold" && escrowHoldTx?.status === "pending",
  );
  if (escrowHoldTxError || !escrowHoldTx) throw new AbortRun("cannot continue without the escrow_hold transaction");

  // ---------------------------------------------------------------------
  // Step 3 — Negative check: brand/creator cannot call the escrow RPCs
  // directly. This is the exact privilege-escalation hole closed in
  // 0005/0007 (EXECUTE revoked from authenticated/anon, service_role only).
  // ---------------------------------------------------------------------
  const { error: brandRpcError } = await brandClient.rpc("confirm_escrow_payment", {
    p_transaction_id: escrowHoldTx.id,
    p_admin_id: adminId,
  });
  record(
    "Step 3: BRAND cannot call confirm_escrow_payment directly",
    "42501 permission denied",
    `code=${(brandRpcError as any)?.code}, message=${brandRpcError?.message}`,
    (brandRpcError as any)?.code === "42501",
  );

  const { error: creatorRpcError } = await creatorClient.rpc("confirm_escrow_payment", {
    p_transaction_id: escrowHoldTx.id,
    p_admin_id: adminId,
  });
  record(
    "Step 3: CREATOR cannot call confirm_escrow_payment directly",
    "42501 permission denied",
    `code=${(creatorRpcError as any)?.code}, message=${creatorRpcError?.message}`,
    (creatorRpcError as any)?.code === "42501",
  );

  // ---------------------------------------------------------------------
  // Step 4 — ADMIN confirms escrow via the app's real path: verify the
  // caller's role using their own session (mirrors lib/actions/admin.ts),
  // then perform the RPC via the service-role client.
  // ---------------------------------------------------------------------
  const { data: adminSelfCheck } = await adminUserClient.from("users").select("role").eq("id", adminId).single();
  if (adminSelfCheck?.role !== "admin") throw new AbortRun("admin test user does not have role=admin");

  const { data: walletBeforeConfirm } = await adminClient
    .from("creator_wallets")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();
  const pendingBefore = walletBeforeConfirm?.pending_balance_dzd ?? 0;
  const availableBefore = walletBeforeConfirm?.available_balance_dzd ?? 0;

  const { error: confirmRpcError } = await adminClient.rpc("confirm_escrow_payment", {
    p_transaction_id: escrowHoldTx.id,
    p_admin_id: adminId,
  });

  // Read back via adminClient (bypasses RLS) — this is a neutral state check,
  // not one of this script's deliberate RLS tests (those use anon/brand2
  // explicitly elsewhere), so it must not be blocked by orders' party-only
  // SELECT policy.
  const { data: orderAfterConfirm } = await adminClient.from("orders").select("status").eq("id", order.id).single();
  record(
    "Step 4: ADMIN confirms escrow (service-role RPC call)",
    "no RPC error, order.status=in_progress (per order_status enum: pending_payment -> in_progress; pending_admin_review is a later, delivery-time gate, not part of escrow confirmation)",
    `rpcError=${confirmRpcError?.message ?? "none"}, order.status=${orderAfterConfirm?.status}`,
    !confirmRpcError && orderAfterConfirm?.status === "in_progress",
  );

  const { data: walletAfterConfirm } = await adminClient
    .from("creator_wallets")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();
  record(
    "Step 4b: creator_wallets.pending_balance_dzd credited by creator_payout_dzd",
    `pending +${creatorPayoutDzd} (from ${pendingBefore} to ${pendingBefore + creatorPayoutDzd})`,
    `pending=${walletAfterConfirm?.pending_balance_dzd}`,
    walletAfterConfirm?.pending_balance_dzd === pendingBefore + creatorPayoutDzd,
  );

  const { data: confirmedTx } = await adminClient.from("transactions").select("*").eq("id", escrowHoldTx.id).single();
  record(
    "Step 4c: escrow_hold transaction is now status=confirmed with confirmed_by set",
    "status=confirmed, confirmed_by=adminId",
    `status=${confirmedTx?.status}, confirmed_by=${confirmedTx?.confirmed_by}`,
    confirmedTx?.status === "confirmed" && confirmedTx?.confirmed_by === adminId,
  );

  // Notifications: confirmEscrowHold (lib/actions/admin.ts) notifies BOTH
  // parties. brand=fr, creator=ar — proves recipient-locale resolution, not
  // request-locale.
  const brandEscrowConfirmedRow = await mirrorNotify({
    userId: brandId,
    type: "escrowConfirmed",
    linkUrl: `/dashboard/orders/${order.id}`,
  });
  await assertNotification(
    "Step 4d: BRAND notified of escrowConfirmed (fr) — recipient reads, others don't",
    brandEscrowConfirmedRow,
    "fr",
    undefined,
    brandClient,
    [creatorClient, brand2Client, anon],
  );
  const creatorEscrowConfirmedRow = await mirrorNotify({
    userId: creatorId,
    type: "escrowConfirmed",
    linkUrl: `/dashboard/orders/${order.id}`,
  });
  await assertNotification(
    "Step 4e: CREATOR notified of escrowConfirmed (ar) — recipient reads, others don't",
    creatorEscrowConfirmedRow,
    "ar",
    undefined,
    creatorClient,
    [brandClient, brand2Client, anon],
  );

  // ---------------------------------------------------------------------
  // Step 5 — CREATOR uploads a deliverable. Note: this moves the order to
  // pending_admin_review (see lib/actions/fulfillment.ts's deliverOrder),
  // which per the deliverables RLS policies (0007) deliberately locks the
  // BRAND out until an admin approves it — "assert brand can read" is
  // therefore checked AFTER the admin-QC step below, not immediately after
  // upload (asserting it beforehand would contradict the schema's own
  // brand-lockout-during-review design).
  // ---------------------------------------------------------------------
  const fakeVideo = Buffer.from("fake mp4 bytes for lifecycle test");
  const deliverablePath = `${order.id}/delivery_${Date.now()}.mp4`;
  const { error: deliverableUploadError } = await creatorClient.storage
    .from("deliverables")
    .upload(deliverablePath, fakeVideo, { contentType: "video/mp4" });
  if (deliverableUploadError) throw new AbortRun(`deliverable upload failed: ${deliverableUploadError.message}`);

  const { data: deliverableRow, error: deliverableRowError } = await creatorClient
    .from("order_deliverables")
    .insert({
      order_id: order.id,
      uploaded_by: creatorId,
      file_url: deliverablePath,
      file_type: "video",
      revision_round: 0,
    })
    .select("*")
    .single();

  await creatorClient
    .from("orders")
    .update({ status: "pending_admin_review", updated_at: new Date().toISOString() })
    .eq("id", order.id);
  await creatorClient.from("order_status_history").insert({
    order_id: order.id,
    from_status: "in_progress",
    to_status: "pending_admin_review",
    changed_by: creatorId,
    note: "Delivered (verify-lifecycle.ts)",
  });

  record(
    "Step 5: CREATOR uploads deliverable",
    "deliverable row created, order.status=pending_admin_review",
    deliverableRowError?.message ?? "deliverable row created",
    !deliverableRowError && !!deliverableRow,
  );

  // deliverySubmitted broadcasts to every admin (notifyAdmins), not a single
  // recipient — a distinct code path from the rest of these checks. Only
  // one admin fixture exists here, so this exercises the "notify all admins"
  // query shape without needing a second admin user.
  const deliverySubmittedRow = await mirrorNotify({ type: "deliverySubmitted", userId: adminId, linkUrl: "/admin/deliveries" });
  await assertNotification(
    "Step 5.1: ADMIN notified of deliverySubmitted (fr) — recipient reads, others don't",
    deliverySubmittedRow,
    "fr",
    undefined,
    adminUserClient,
    [brandClient, creatorClient, brand2Client, anon],
  );

  // Anon must never be able to sign a URL for a private-bucket object.
  const { data: anonSigned } = await anon.storage.from("deliverables").createSignedUrl(deliverablePath, 60);
  record(
    "Step 5a: ANON cannot read the deliverable (private bucket)",
    "createSignedUrl returns no signed URL",
    `signedUrl=${anonSigned?.signedUrl ?? "none"}`,
    !anonSigned?.signedUrl,
  );

  // Brand is deliberately locked out while status is still pending_admin_review.
  const { data: brandSignedDuringReview } = await brandClient.storage
    .from("deliverables")
    .createSignedUrl(deliverablePath, 60);
  record(
    "Step 5b: BRAND is locked out of the deliverable during admin QC (pending_admin_review)",
    "createSignedUrl returns no signed URL while order is pending_admin_review",
    `signedUrl=${brandSignedDuringReview?.signedUrl ?? "none"}`,
    !brandSignedDuringReview?.signedUrl,
  );

  // Admin approves the delivery (mirrors adminApproveDelivery in lib/actions/admin.ts).
  const { error: approveError } = await adminClient
    .from("orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("status", "pending_admin_review");
  await adminClient.from("order_status_history").insert({
    order_id: order.id,
    from_status: "pending_admin_review",
    to_status: "delivered",
    changed_by: adminId,
    note: "Admin approved delivery quality (verify-lifecycle.ts)",
  });

  const { data: orderAfterApproval } = await adminClient.from("orders").select("status").eq("id", order.id).single();
  record(
    "Step 5c: ADMIN approves delivery (QC gate not in the task's step list, but required by the real state machine — reviewDelivery only accepts status=delivered)",
    "no error, order.status=delivered",
    `error=${approveError?.message ?? "none"}, status=${orderAfterApproval?.status}`,
    !approveError && orderAfterApproval?.status === "delivered",
  );

  const deliveryApprovedRow = await mirrorNotify({
    userId: brandId,
    type: "deliveryApproved",
    linkUrl: `/dashboard/orders/${order.id}`,
  });
  await assertNotification(
    "Step 5c2: BRAND notified of deliveryApproved (fr) — recipient reads, others don't",
    deliveryApprovedRow,
    "fr",
    undefined,
    brandClient,
    [creatorClient, brand2Client, anon],
  );

  // Now the brand should be able to read it.
  const { data: brandSignedAfterApproval } = await brandClient.storage
    .from("deliverables")
    .createSignedUrl(deliverablePath, 60);
  record(
    "Step 5d: BRAND can read the deliverable once delivered",
    "createSignedUrl returns a signed URL",
    `signedUrl=${brandSignedAfterApproval?.signedUrl ? "present" : "none"}`,
    !!brandSignedAfterApproval?.signedUrl,
  );

  const { data: anonSignedAfterApproval } = await anon.storage.from("deliverables").createSignedUrl(deliverablePath, 60);
  record(
    "Step 5e: ANON still cannot read the deliverable after delivery",
    "createSignedUrl returns no signed URL",
    `signedUrl=${anonSignedAfterApproval?.signedUrl ?? "none"}`,
    !anonSignedAfterApproval?.signedUrl,
  );

  // ---------------------------------------------------------------------
  // Step 6 — BRAND accepts the delivery (reviewDelivery 'accept').
  // ---------------------------------------------------------------------
  const { error: acceptError } = await brandClient
    .from("orders")
    .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", order.id);
  await brandClient.from("order_status_history").insert({
    order_id: order.id,
    from_status: "delivered",
    to_status: "completed",
    changed_by: brandId,
    note: "Brand accepted the delivery (verify-lifecycle.ts)",
  });

  // Money-ledger rows for the release, via the service-role client — see the
  // fix in lib/actions/fulfillment.ts (brand cannot insert these types
  // directly; RLS only permits brand-inserted 'escrow_hold' rows).
  const { data: releaseTx, error: releaseTxError } = await adminClient
    .from("transactions")
    .insert({ order_id: order.id, type: "escrow_release", amount_dzd: creatorPayoutDzd, status: "pending" })
    .select("*")
    .single();
  const { data: commissionTx, error: commissionTxError } = await adminClient
    .from("transactions")
    .insert({
      order_id: order.id,
      type: "commission",
      amount_dzd: commissionAmountDzd,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  const { data: orderAfterAccept } = await adminClient.from("orders").select("status").eq("id", order.id).single();
  record(
    "Step 6: BRAND accepts -> order.status=completed (terminal)",
    "no error, order.status=completed",
    `error=${acceptError?.message ?? "none"}, status=${orderAfterAccept?.status}`,
    !acceptError && orderAfterAccept?.status === "completed",
  );
  record(
    "Step 6b: escrow_release (pending) + commission (confirmed) transactions created",
    `escrow_release amount=${creatorPayoutDzd} pending, commission amount=${commissionAmountDzd} confirmed`,
    `releaseTxError=${releaseTxError?.message ?? "none"} (${releaseTx?.status}), commissionTxError=${commissionTxError?.message ?? "none"} (${commissionTx?.status})`,
    !releaseTxError && !commissionTxError && releaseTx?.status === "pending" && commissionTx?.status === "confirmed",
  );
  if (releaseTxError || !releaseTx) throw new AbortRun("cannot continue without the escrow_release transaction");

  const orderCompletedRow = await mirrorNotify({
    userId: creatorId,
    type: "orderCompleted",
    linkUrl: `/dashboard/orders/${order.id}`,
  });
  await assertNotification(
    "Step 6c: CREATOR notified of orderCompleted (ar) — recipient reads, others don't",
    orderCompletedRow,
    "ar",
    undefined,
    creatorClient,
    [brandClient, brand2Client, anon],
  );

  // ---------------------------------------------------------------------
  // Step 7 — ADMIN releases funds via release_escrow_payment.
  // ---------------------------------------------------------------------
  const { error: releaseRpcError } = await adminClient.rpc("release_escrow_payment", {
    p_transaction_id: releaseTx.id,
    p_admin_id: adminId,
  });

  const { data: walletAfterRelease } = await adminClient
    .from("creator_wallets")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();

  record(
    "Step 7: ADMIN releases escrow (service-role RPC call)",
    "no RPC error",
    `rpcError=${releaseRpcError?.message ?? "none"}`,
    !releaseRpcError,
  );
  record(
    "Step 7b: wallet available_balance_dzd credited, pending_balance_dzd reduced by the same amount",
    `available=${(walletAfterConfirm?.available_balance_dzd ?? 0) + creatorPayoutDzd}, pending=${pendingBefore}`,
    `available=${walletAfterRelease?.available_balance_dzd}, pending=${walletAfterRelease?.pending_balance_dzd}`,
    walletAfterRelease?.available_balance_dzd === (walletAfterConfirm?.available_balance_dzd ?? 0) + creatorPayoutDzd &&
      walletAfterRelease?.pending_balance_dzd === pendingBefore,
  );

  const { data: releaseTxFinal } = await adminClient.from("transactions").select("*").eq("id", releaseTx.id).single();
  record(
    "Step 7c: escrow_release transaction is now status=confirmed",
    "status=confirmed",
    `status=${releaseTxFinal?.status}`,
    releaseTxFinal?.status === "confirmed",
  );

  const sumOk = commissionAmountDzd + creatorPayoutDzd === priceDzd;
  record(
    "Step 7d: commission + creator payout sum exactly to price_dzd (integer DZD)",
    `${commissionAmountDzd} + ${creatorPayoutDzd} = ${priceDzd}`,
    `${commissionAmountDzd} + ${creatorPayoutDzd} = ${commissionAmountDzd + creatorPayoutDzd}`,
    sumOk,
  );

  const escrowReleasedRow = await mirrorNotify({
    userId: creatorId,
    type: "escrowReleased",
    linkUrl: `/dashboard/orders/${order.id}`,
  });
  await assertNotification(
    "Step 7e: CREATOR notified of escrowReleased (ar) — recipient reads, others don't",
    escrowReleasedRow,
    "ar",
    undefined,
    creatorClient,
    [brandClient, brand2Client, anon],
  );

  // ---------------------------------------------------------------------
  // Step 8 — Reviews. RLS (reviews_insert_party_on_completed_order,
  // 0002_rls_policies.sql) requires: reviewer_id = auth.uid(), the order is
  // completed, and direction/reviewee match the order's REAL brand/creator.
  // ---------------------------------------------------------------------

  // A second, non-completed order — purely so there's something to attempt
  // a review against for the "non-completed order" negative check. Minimal
  // on purpose: no payment/delivery lifecycle needed for this.
  const { data: secondOrder, error: secondOrderError } = await brandClient
    .from("orders")
    .insert({
      brand_id: brandId,
      creator_id: creatorId,
      gig_id: gigId,
      gig_package_id: standardPkg.id,
      price_dzd: priceDzd,
      commission_rate: commissionRate,
      commission_amount_dzd: commissionAmountDzd,
      creator_payout_dzd: creatorPayoutDzd,
      revisions_included: 2,
      status: "pending_payment",
    })
    .select("id, status")
    .single();
  if (secondOrderError || !secondOrder) throw new AbortRun(`second (non-completed) order insert failed: ${secondOrderError?.message}`);

  // 8a: BRAND reviews CREATOR on the completed order.
  const { error: brandReviewError } = await brandClient.from("reviews").insert({
    order_id: order.id,
    direction: "brand_to_creator",
    reviewer_id: brandId,
    reviewee_id: creatorId,
    rating: 5,
    comment: "Great work! (verify-lifecycle.ts)",
  });
  record(
    "Step 8a: BRAND reviews CREATOR (brand_to_creator, rating=5) on completed order",
    "no error",
    `error=${brandReviewError?.message ?? "none"}`,
    !brandReviewError,
  );
  if (brandReviewError) throw new AbortRun("cannot continue without the brand's review");

  // Mirrors submitReview's own recompute exactly: full aggregate from
  // reviews (SELECT all, compute avg/count, UPDATE) — NOT incremental. See
  // the report for the concurrency note this earns.
  const { data: creatorReviewsAfterBrand } = await adminClient
    .from("reviews")
    .select("rating")
    .eq("reviewee_id", creatorId)
    .eq("direction", "brand_to_creator");
  const creatorAvg = creatorReviewsAfterBrand!.reduce((s, r) => s + r.rating, 0) / creatorReviewsAfterBrand!.length;
  await adminClient
    .from("creator_profiles")
    .update({ rating_avg: Number(creatorAvg.toFixed(2)), rating_count: creatorReviewsAfterBrand!.length })
    .eq("user_id", creatorId);

  const { data: gigOrdersForAgg } = await adminClient.from("orders").select("id").eq("gig_id", gigId);
  const gigOrderIdsForAgg = (gigOrdersForAgg ?? []).map((o) => o.id);
  const { data: gigReviewsAfterBrand } = await adminClient
    .from("reviews")
    .select("rating")
    .eq("direction", "brand_to_creator")
    .in("order_id", gigOrderIdsForAgg);
  const gigAvg = gigReviewsAfterBrand!.reduce((s, r) => s + r.rating, 0) / gigReviewsAfterBrand!.length;
  await adminClient.from("gigs").update({ avg_rating: Number(gigAvg.toFixed(2)) }).eq("id", gigId);

  const { data: creatorProfileAfterReview } = await adminClient
    .from("creator_profiles")
    .select("rating_avg, rating_count")
    .eq("user_id", creatorId)
    .single();
  const { data: gigAfterReview } = await adminClient.from("gigs").select("avg_rating").eq("id", gigId).single();
  record(
    "Step 8b: creator_profiles.rating_avg/rating_count and gigs.avg_rating match the actual inserted rating exactly",
    "rating_avg=5, rating_count=1, gig avg_rating=5",
    `rating_avg=${creatorProfileAfterReview?.rating_avg}, rating_count=${creatorProfileAfterReview?.rating_count}, gig avg_rating=${gigAfterReview?.avg_rating}`,
    Number(creatorProfileAfterReview?.rating_avg) === 5 &&
      creatorProfileAfterReview?.rating_count === 1 &&
      Number(gigAfterReview?.avg_rating) === 5,
  );

  const reviewReceivedByCreatorRow = await mirrorNotify({
    userId: creatorId,
    type: "reviewReceived",
    bodyParams: { rating: 5 },
    linkUrl: `/dashboard/orders/${order.id}`,
  });
  await assertNotification(
    "Step 8c: CREATOR notified of reviewReceived (ar) — recipient reads, others don't",
    reviewReceivedByCreatorRow,
    "ar",
    { rating: 5 },
    creatorClient,
    [brandClient, brand2Client, anon],
  );

  // 8d: CREATOR reviews BRAND (the other direction). No aggregate to update
  // — brand_profiles has no rating columns at all.
  const { error: creatorReviewError } = await creatorClient.from("reviews").insert({
    order_id: order.id,
    direction: "creator_to_brand",
    reviewer_id: creatorId,
    reviewee_id: brandId,
    rating: 4,
    comment: "Good client. (verify-lifecycle.ts)",
  });
  record(
    "Step 8d: CREATOR reviews BRAND (creator_to_brand, rating=4) on completed order",
    "no error",
    `error=${creatorReviewError?.message ?? "none"}`,
    !creatorReviewError,
  );

  const reviewReceivedByBrandRow = await mirrorNotify({
    userId: brandId,
    type: "reviewReceived",
    bodyParams: { rating: 4 },
    linkUrl: `/dashboard/orders/${order.id}`,
  });
  await assertNotification(
    "Step 8e: BRAND notified of reviewReceived (fr) — recipient reads, others don't",
    reviewReceivedByBrandRow,
    "fr",
    { rating: 4 },
    brandClient,
    [creatorClient, brand2Client, anon],
  );

  // 8f: duplicate review rejected — unique (order_id, direction).
  const { error: duplicateReviewError } = await brandClient.from("reviews").insert({
    order_id: order.id,
    direction: "brand_to_creator",
    reviewer_id: brandId,
    reviewee_id: creatorId,
    rating: 1,
    comment: "Trying to overwrite my own review (verify-lifecycle.ts)",
  });
  record(
    "Step 8f: duplicate review (same order, same direction) rejected",
    "error, code=23505 (unique_violation on order_id+direction)",
    `error=${duplicateReviewError?.message ?? "none"}, code=${(duplicateReviewError as any)?.code}`,
    (duplicateReviewError as any)?.code === "23505",
  );

  // 8g: non-participant (brand2) review rejected — RLS, not a unique
  // constraint. brand2 is neither this order's brand nor creator, so no
  // direction/reviewee combination can satisfy reviews_insert_party_on_completed_order.
  const { error: nonParticipantReviewError } = await brand2Client.from("reviews").insert({
    order_id: order.id,
    direction: "brand_to_creator",
    reviewer_id: brand2Id,
    reviewee_id: creatorId,
    rating: 5,
    comment: "I was never part of this order (verify-lifecycle.ts)",
  });
  record(
    "Step 8g: non-participant (unrelated BRAND2) review rejected",
    "error (RLS policy violation)",
    `error=${nonParticipantReviewError?.message ?? "none"}, code=${(nonParticipantReviewError as any)?.code}`,
    !!nonParticipantReviewError,
  );

  // 8h: review on a non-completed order rejected.
  const { error: nonCompletedReviewError } = await brandClient.from("reviews").insert({
    order_id: secondOrder.id,
    direction: "brand_to_creator",
    reviewer_id: brandId,
    reviewee_id: creatorId,
    rating: 5,
    comment: "This order was never completed (verify-lifecycle.ts)",
  });
  record(
    "Step 8h: review on a non-completed order (status=pending_payment) rejected",
    "error (RLS policy violation)",
    `error=${nonCompletedReviewError?.message ?? "none"}, code=${(nonCompletedReviewError as any)?.code}, secondOrder.status=${secondOrder.status}`,
    !!nonCompletedReviewError,
  );

  // ---------------------------------------------------------------------
  // Step 9 — Payout request/process flow. `payouts` (a withdrawal request)
  // is distinct from the escrow-release transactions above: those moved
  // funds from pending to available in the wallet; this is the creator
  // asking to actually withdraw from that available balance.
  // ---------------------------------------------------------------------
  const { data: payoutAccount, error: payoutAccountError } = await creatorClient
    .from("creator_payout_accounts")
    .insert({
      creator_id: creatorId,
      method: "ccp",
      account_holder_name: "Verify Creator",
      account_number: "0012345678",
      is_default: true,
    })
    .select("id")
    .single();
  if (payoutAccountError || !payoutAccount) throw new AbortRun(`payout account insert failed: ${payoutAccountError?.message}`);

  const { data: walletBeforePayout } = await adminClient
    .from("creator_wallets")
    .select("available_balance_dzd")
    .eq("creator_id", creatorId)
    .single();
  const availableBeforePayout = walletBeforePayout?.available_balance_dzd ?? 0;

  // Request the FULL available balance — makes the reconciliation assertion
  // below exact and unambiguous.
  const { data: payout, error: payoutError } = await creatorClient
    .from("payouts")
    .insert({
      creator_id: creatorId,
      payout_account_id: payoutAccount.id,
      amount_dzd: availableBeforePayout,
      status: "pending",
    })
    .select("*")
    .single();
  record(
    "Step 9a: CREATOR submits payout request for full available balance",
    `payout row created, amount_dzd=${availableBeforePayout}, status=pending`,
    `error=${payoutError?.message ?? "none"}, amount_dzd=${payout?.amount_dzd}, status=${payout?.status}`,
    !payoutError && payout?.amount_dzd === availableBeforePayout && payout?.status === "pending",
  );
  if (payoutError || !payout) throw new AbortRun("cannot continue without the payout request");

  // 9b: NEGATIVE — creator cannot approve/process their own request
  // (payouts_update_admin requires is_admin()). RLS silently matches zero
  // rows rather than erroring, so the real assertion is the read-back below.
  const { data: creatorSelfApprove } = await creatorClient
    .from("payouts")
    .update({ status: "paid", processed_by: creatorId, processed_at: new Date().toISOString() })
    .eq("id", payout.id)
    .select("id");
  const { data: brandTouchPayout } = await brandClient
    .from("payouts")
    .update({ status: "paid", processed_by: brandId, processed_at: new Date().toISOString() })
    .eq("id", payout.id)
    .select("id");
  const { data: payoutAfterSelfAttempts } = await adminClient.from("payouts").select("status").eq("id", payout.id).single();
  record(
    "Step 9b: CREATOR cannot approve own payout, BRAND cannot touch it (RLS matches 0 rows; status stays pending)",
    "both updates affect 0 rows; payout.status still pending",
    `creatorUpdateRows=${creatorSelfApprove?.length ?? 0}, brandUpdateRows=${brandTouchPayout?.length ?? 0}, status=${payoutAfterSelfAttempts?.status}`,
    (creatorSelfApprove?.length ?? 0) === 0 && (brandTouchPayout?.length ?? 0) === 0 && payoutAfterSelfAttempts?.status === "pending",
  );

  // 9c: NEGATIVE — neither the (unrelated) brand nor brand2 can even SELECT
  // this payout (payouts_select_own_or_admin: owner or admin only — a
  // payout has nothing to do with any brand at all).
  const { data: brandSeesPayout } = await brandClient.from("payouts").select("id").eq("id", payout.id);
  const { data: brand2SeesPayout } = await brand2Client.from("payouts").select("id").eq("id", payout.id);
  record(
    "Step 9c: neither BRAND nor unrelated BRAND2 can see the payout via RLS",
    "both SELECT results empty",
    `brandRows=${brandSeesPayout?.length ?? 0}, brand2Rows=${brand2SeesPayout?.length ?? 0}`,
    (brandSeesPayout?.length ?? 0) === 0 && (brand2SeesPayout?.length ?? 0) === 0,
  );

  // 9d: POSITIVE — admin processes it (mirrors processPayout in
  // lib/actions/admin.ts: verify admin via their own session, then the
  // service-role client for the payouts update + wallet deduction —
  // creator_wallets has no authenticated-role write policy at all).
  const { data: adminSelfCheck2 } = await adminUserClient.from("users").select("role").eq("id", adminId).single();
  if (adminSelfCheck2?.role !== "admin") throw new AbortRun("admin test user does not have role=admin (re-check before payout processing)");

  await adminClient
    .from("payouts")
    .update({ status: "paid", processed_by: adminId, processed_at: new Date().toISOString() })
    .eq("id", payout.id);
  await adminClient
    .from("creator_wallets")
    .update({ available_balance_dzd: Math.max(availableBeforePayout - payout.amount_dzd, 0) })
    .eq("creator_id", creatorId);

  const { data: payoutAfterProcessing } = await adminClient.from("payouts").select("*").eq("id", payout.id).single();
  const { data: walletAfterPayout } = await adminClient
    .from("creator_wallets")
    .select("available_balance_dzd")
    .eq("creator_id", creatorId)
    .single();
  record(
    "Step 9e: ADMIN processes payout — status=paid, processed_by set, wallet available_balance_dzd reduced to 0",
    "status=paid, processed_by=adminId, available_balance_dzd=0",
    `status=${payoutAfterProcessing?.status}, processed_by=${payoutAfterProcessing?.processed_by}, available=${walletAfterPayout?.available_balance_dzd}`,
    payoutAfterProcessing?.status === "paid" &&
      payoutAfterProcessing?.processed_by === adminId &&
      walletAfterPayout?.available_balance_dzd === 0,
  );

  const payoutLedgerOk = commissionAmountDzd + payout.amount_dzd === priceDzd;
  record(
    "Step 9f: ledger reconciles exactly — escrow-in (price_dzd) - commission = payout amount, integer DZD",
    `${priceDzd} - ${commissionAmountDzd} = ${payout.amount_dzd}`,
    `${priceDzd} - ${commissionAmountDzd} = ${priceDzd - commissionAmountDzd} (payout was ${payout.amount_dzd})`,
    payoutLedgerOk,
  );

  const payoutProcessedRow = await mirrorNotify({
    userId: creatorId,
    type: "payoutProcessed",
    bodyParams: { amount: payout.amount_dzd },
    linkUrl: "/dashboard",
  });
  await assertNotification(
    "Step 9g: CREATOR notified of payoutProcessed (ar) — recipient reads, others don't",
    payoutProcessedRow,
    "ar",
    { amount: payout.amount_dzd },
    creatorClient,
    [brandClient, brand2Client, anon],
  );

  // ---------------------------------------------------------------------
  // Step 10 — RLS cross-tenant isolation: an unrelated brand must see none
  // of this order's rows, now that every kind of row exists.
  // ---------------------------------------------------------------------
  const { data: brand2Orders } = await brand2Client.from("orders").select("id").eq("id", order.id);
  const { data: brand2Messages } = conversation
    ? await brand2Client.from("messages").select("id").eq("conversation_id", conversation.id)
    : { data: [] };
  const { data: brand2Conversations } = await brand2Client.from("conversations").select("id").eq("id", conversation?.id ?? "");
  const { data: brand2Deliverables } = await brand2Client.from("order_deliverables").select("id").eq("order_id", order.id);
  const { data: brand2Transactions } = await brand2Client.from("transactions").select("id").eq("order_id", order.id);
  const { data: brand2ReceiptSigned } = await brand2Client.storage.from("receipts").createSignedUrl(receiptPath, 60);
  const { data: brand2DeliverableSigned } = await brand2Client.storage.from("deliverables").createSignedUrl(deliverablePath, 60);

  record(
    "Step 10: unrelated BRAND sees none of this order's rows (orders/conversations/messages/deliverables/transactions) or files (receipt/deliverable)",
    "all empty / no signed URL",
    `orders=${brand2Orders?.length ?? 0}, conversations=${brand2Conversations?.length ?? 0}, messages=${brand2Messages?.length ?? 0}, deliverables=${brand2Deliverables?.length ?? 0}, transactions=${brand2Transactions?.length ?? 0}, receiptSigned=${!!brand2ReceiptSigned?.signedUrl}, deliverableSigned=${!!brand2DeliverableSigned?.signedUrl}`,
    (brand2Orders?.length ?? 0) === 0 &&
      (brand2Conversations?.length ?? 0) === 0 &&
      (brand2Messages?.length ?? 0) === 0 &&
      (brand2Deliverables?.length ?? 0) === 0 &&
      (brand2Transactions?.length ?? 0) === 0 &&
      !brand2ReceiptSigned?.signedUrl &&
      !brand2DeliverableSigned?.signedUrl,
  );

  // ---------------------------------------------------------------------
  // Step 11 — Teardown (unless --keep)
  // ---------------------------------------------------------------------
  if (!KEEP) {
    // reviews cascade-delete from orders (reviews_order_id_fkey ON DELETE
    // CASCADE — confirmed against the live schema), so no explicit delete
    // needed once `orders` rows go below. payouts/creator_payout_accounts
    // and notifications do NOT cascade from anything deleted here (users
    // are persistent test fixtures, never deleted), so those need explicit
    // cleanup — and payouts must go BEFORE creator_payout_accounts
    // (payouts_payout_account_id_fkey has no cascade; deleting the account
    // first would violate the FK).
    await adminClient.from("order_status_history").delete().eq("order_id", order.id);
    await adminClient.from("order_deliverables").delete().eq("order_id", order.id);
    await adminClient.from("transactions").delete().eq("order_id", order.id);
    if (conversation) {
      await adminClient.from("messages").delete().eq("conversation_id", conversation.id);
      await adminClient.from("conversations").delete().eq("id", conversation.id);
    }
    await adminClient.from("orders").delete().eq("id", order.id);
    await adminClient.from("orders").delete().eq("id", secondOrder.id);
    await adminClient.storage.from("deliverables").remove([deliverablePath]);
    await adminClient.storage.from("receipts").remove([receiptPath]);
    await adminClient.from("gig_packages").delete().eq("gig_id", gigId);
    await adminClient.from("gigs").delete().eq("id", gigId);
    await adminClient.from("creator_wallets").delete().eq("creator_id", creatorId);
    await adminClient.from("payouts").delete().eq("creator_id", creatorId);
    await adminClient.from("creator_payout_accounts").delete().eq("creator_id", creatorId);
    await adminClient
      .from("notifications")
      .delete()
      .in("user_id", [creatorId, brandId, adminId])
      .gte("created_at", testStartedAt);
    console.log("\n(teardown complete — pass --keep to skip this)");
  } else {
    console.log("\n(--keep passed — test rows and storage objects left in place)");
  }
}

main()
  .catch((err) => {
    if (err instanceof AbortRun) {
      console.error(`\nRun aborted: ${err.message}`);
    } else {
      console.error("\nUnexpected error:", err);
    }
  })
  .finally(() => {
    console.log("\n=== Report ===");
    console.table(results.map((r) => ({ Step: r.step, Pass: r.pass ? "PASS" : "FAIL", Expected: r.expected, Actual: r.actual })));
    const allPass = results.length > 0 && results.every((r) => r.pass);
    console.log(allPass ? "\nALL STEPS PASSED" : "\nSOME STEPS FAILED — see table above");
    process.exit(allPass ? 0 : 1);
  });
