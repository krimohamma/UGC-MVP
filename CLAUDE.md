# CLAUDE.md

This file gives Claude Code context for working in this repository.

## What this is

A two-sided freelance marketplace for Algeria connecting **UGC (user-generated
content) creators** with **ecommerce brands/stores** — niche-focused, in the
spirit of Fiverr. Supports French, Arabic, and English (RTL applies only to
Arabic).

Core flow:

1. A **creator** builds a profile with a **portfolio** — multiple sample
   videos (uploaded, or linked from TikTok/Instagram), reorderable — since
   brands deciding whether to order need to watch past work, not take it on
   faith. They then publish a **gig** (e.g. "1 TikTok-style product ad video")
   with three **packages** (basic/standard/premium), each with its own price,
   delivery time, and revision count.
2. A **brand** browses gigs by niche, price, and content language, then places
   an **order** against one package.
3. The brand pays into **escrow**. Payment is manual at first (CCP /
   BaridiMob transfer) and confirmed by an **admin** — there is no live
   payment gateway yet.
4. The order moves through a lifecycle:
   `pending_payment → in_progress → delivered → revision_requested → completed`
   (with `cancelled` / `disputed` as side paths). Every transition is written
   to `order_status_history`.
5. Brand and creator communicate through a **realtime chat thread** tied to
   the order (or a pre-order inquiry thread with no order yet).
6. The creator uploads **file deliverables** (videos); revisions bump
   `revision_round`.
7. Once `completed`, both sides can leave a **review**.
8. The platform takes a **commission** (snapshotted per order in
   `commission_rate`/`commission_amount_dzd`), and creators withdraw their
   balance via a **payout** request, paid out manually by an admin to their
   CCP/BaridiMob account.

Three user roles: `creator`, `brand`, `admin`. A user has exactly one role.

### History
* **Phase 1**: Database schema (`0001_initial_schema.sql`, `0002_rls_policies.sql`), auth integration, and scaffolding for the app.
* **Phase 2**: Creator profiles (niches, payout methods) and portfolio (`0003_portfolio_items.sql`) with uploads to the `portfolio` bucket (`0004_storage.sql`).
* **Phase 3**: Escrow payment infrastructure. `0005_orders_escrow.sql` — the private `receipts` bucket and the `confirm_escrow_payment` RPC. Admin Transactions UI and DZD integer commission logic.
* **Phase 4**: Fulfillment and Realtime Chat. `0006_fulfillment.sql` adds the `pending_admin_review` order status; `0007_fulfillment_objects.sql` adds the `deliverables` bucket and `release_escrow_payment` RPC (split because a new enum value can't be used in the same transaction that adds it). Order Workspace, Realtime Chat, Delivery QC, Admin Escrow Release UI. Localized AR/FR.
* **Migration/live-DB reconciliation (2026-07-13)**: 0005–0007 existed on disk but had never been applied to the live project, and `lib/database.types.ts` had been hand-patched to paper over that — so the whole Phase 3/4 surface would have failed at runtime while typechecking clean. Applied the migrations (via the claude.ai Supabase connector's `apply_migration`; direct `db push` fails on a DNS issue reaching the DB host), regenerated the types from the live DB, and hardened both escrow RPCs (see the security note under "Supabase clients").
* **Security hardening + end-to-end lifecycle verification (2026-07-13)**:
  * `0008_security_hardening.sql`: closed the advisor WARNs left after 0001–0007 (mutable `search_path` on the two trigger functions; the `portfolio` bucket's unrestricted listing policy). `citext` in `public` is a deliberately accepted WARN — see the Database section.
  * `0009_fix_escrow_rpc_guard.sql`: **fixed a real bug**, found by `scripts/verify-lifecycle.ts`, in both escrow RPCs' in-function caller guard. It checked `current_user = 'service_role'`, but inside a `SECURITY DEFINER` function `current_user` reflects the function's *owner* (`postgres`), not the caller — so the guard rejected the one caller it was meant to allow (`lib/actions/admin.ts`'s legitimate service-role calls), unconditionally. Fixed by checking `current_setting('role', true)` instead, which correctly reports the PostgREST-assigned role even inside `SECURITY DEFINER` (confirmed empirically for both the legacy JWT and the new `sb_secret_...` key format — see the migration's own comment for the debugging trail). The EXECUTE grant (service_role only) was never the broken part.
  * Found and fixed three real app-code bugs while building the verification script (all fixed in app code, per instruction, not by changing the schema):
    1. `lib/actions/fulfillment.ts`'s `reviewDelivery` (`accept` branch) inserted `transactions` rows (`escrow_release`, and no `commission` row at all) using the brand's own RLS-scoped client — but RLS only permits a brand to insert `type='escrow_hold'` rows. Fixed to use the service-role client for this bookkeeping (same pattern as `lib/actions/admin.ts`) and added the missing `commission` transaction (booked immediately as `confirmed` — it's not a bank transfer needing manual confirmation, unlike escrow hold/release).
    2. `components/orders/delivery-form.tsx` stored `getPublicUrl()`'s result for the **private** `deliverables` bucket — unservable regardless of RLS, since public-URL access only works for `public = true` buckets. Fixed to store the raw object path (matching the `receipts` bucket's existing correct pattern) and sign it for display where read.
    3. `app/[locale]/(dashboard)/dashboard/orders/[orderId]/page.tsx` and `app/[locale]/(admin)/admin/deliveries/page.tsx` rendered that raw path directly as if it were a URL; fixed to generate a short-lived signed URL server-side before passing data to the client components (mirrors the existing correct pattern in `admin/transactions/page.tsx` for receipts).
  * `scripts/verify-lifecycle.ts` exercises the full order/escrow lifecycle against the live project with real signed-in JWTs (creator/brand/admin/a second unrelated brand for RLS isolation), service-role only where the app itself uses it. Confirmed passing, twice in a row (proving the teardown path is clean and the script is genuinely repeatable): checkout → payment proof → privilege-escalation negative checks (both brand and creator get `42501` calling the RPCs directly) → admin confirms escrow → creator delivers → brand is locked out during admin QC, admin approves, brand can then read it → brand accepts → admin releases funds → commission math exact against the price snapshot → a second, unrelated brand sees none of this order's rows or files. Run it with `npx tsx scripts/verify-lifecycle.ts` (add `--keep` to skip teardown for manual inspection).
  * One note for whoever re-runs this: the sandbox this was verified in occasionally hits a connect-timeout on the very first outbound HTTPS call a fresh Node process makes (every subsequent call, and every isolated single-call retry, succeeds) — `scripts/verify-lifecycle.ts` absorbs this with one retried warm-up call before doing anything stateful. If it happens elsewhere, that's the mechanism to look at, not the schema/RLS.
  * New advisor WARN observed that's unrelated to any migration here and out of this session's scope: `auth_leaked_password_protection` (an Auth project *setting* — HaveIBeenPwned checking — not something SQL can touch). Not acted on; flagging for a future session.
* **Reviews, notifications, and MVP-surface completion (2026-07-14)**:
  * Housekeeping: signup password minimum raised to 8 chars, enforced server-side via a real zod schema (`lib/validation/auth.ts`) — previously only an HTML `minLength` attribute, bypassable by any direct API call. Confirmed `lib/database.types.ts` was already current post-`0009` (byte-identical on regeneration) and re-confirmed after `0010` below.
  * **Reviews are live**: `reviews` and its RLS already existed (`0002_rls_policies.sql`) but no app code used them. Added `lib/actions/review.ts`'s `submitReview` — inserts via the caller's own RLS-scoped client (matches `reviews_insert_party_on_completed_order` exactly: direction/reviewee derived from the order's real brand/creator, never from client input), then recomputes `creator_profiles.rating_avg`/`rating_count` and the specific gig's `avg_rating` via the service-role client (same "RLS permits the write, but not the denormalized bookkeeping on someone else's row" pattern as `reviewDelivery`'s transaction inserts). `creator_to_brand` reviews have nothing to aggregate to — `brand_profiles` has no rating columns. Fixed `gig-card.tsx`/`gig-detail-view.tsx`/`profile-form.tsx`, which previously displayed a fabricated "5.0" for gigs/creators with zero reviews (`|| 5.0` fallback) — now shows "no reviews yet" until `rating_count > 0`.
  * **`0010_notifications.sql`**: new `notifications` table (owner read/update via RLS, insert is service-role only — no policy granted to `authenticated`/`anon`, by design). `lib/notify.ts`'s `notify()`/`notifyAdmins()` resolve message text server-side in the *recipient's* `users.locale` (not the acting user's request locale) via `next-intl/server`'s `getTranslations({locale, namespace})`, since the stored `title`/`body` are plain text, not translation keys — a bell component just renders them as-is. Wired into: escrow confirm/release, delivery submit/approve/reject, order completion, review received, payout processed, dispute opened.
  * **Order workspace**: added a `StatusTimeline` (renders `order_status_history` chronologically, including the `pending_admin_review` QC gate) and wired `ReviewForm` in for `completed` orders. Fixed the chat bubbles' RTL bug — they used physical `rounded-tr-sm`/`rounded-tl-sm` (CLAUDE.md's own "never use physical utilities" rule), which put the bubble's flattened corner on the wrong side in Arabic; now `rounded-se-sm`/`rounded-ss-sm`. Extended `order-workspace.tsx`/the order page with a third `role: "admin"` (read-only: timeline + deliverable link + reviews, no chat — RLS wouldn't let admin post into `messages` anyway since they aren't `brand_id`/`creator_id`). Revision flow (redelivery, `revisions_included` cap enforced in both UI and `lib/actions/fulfillment.ts`) was already correct — verified, not rebuilt.
  * **Admin dashboard, actually completed**: `/admin` was a static placeholder with no nav at all; `(admin)/layout.tsx` rendered the generic `SiteHeader` (no admin links). Added `AdminHeader` (own header per CLAUDE.md's existing guidance, not branching inside `SiteHeader`) and a real `/admin` home with live pending-counts across all four queues. New: creator-facing payout request (`requestPayout` — plain RLS-permitted insert, validated against `creator_wallets.available_balance_dzd` server-side since RLS can't check that) and the admin-facing `/admin/payouts` queue (`processPayout` — service-role client, since `creator_wallets` has no authenticated-role write policy at all; distinct from `confirmEscrowRelease`, which moves funds from *pending* to *available*, not to the creator's bank). New `/admin/gigs` moderation (activate/deactivate) — a plain RLS-permitted update via the admin's own session (`gigs_update_own_or_admin` already allows `is_admin()`), no service-role client needed.
  * Fixed a real, pre-existing bug found while reading `transaction-list.tsx` for reference: `admin/transactions/page.tsx` already resolves `proof_image_url` to a signed URL server-side (the `receipts` bucket is private), but the list component then wrapped that already-resolved URL inside a second, broken "public" object URL — meaning admins could never actually open a receipt. Fixed to use the signed URL directly.
  * Verified all new PostgREST embed/join syntax (disambiguated FK hints like `users!payouts_creator_id_fkey(...)`) against the live REST API before trusting it, since `tsc`/`next build` can't validate stringly-typed Supabase query strings — a bad embed returns `400`, and all returned `200`.
  * Deliberately not built this session (flagging, not fixing): `gigs.orders_count` is still never incremented anywhere in the app — a pre-existing gap noticed while fixing the rating display, unrelated to reviews specifically. Disputes are created and now notify admins, but there's no dedicated `/admin/disputes` page yet to view/resolve them — only the notification. New chat messages don't generate notifications (deliberate — realtime chat already surfaces them live to anyone viewing the thread; adding a notification row per message risked being pure noise).
  * **This session's work was built but not run through `scripts/verify-lifecycle.ts`** — closed in the next entry below.
* **Reviews/notifications/payouts verified end-to-end, `scripts/verify-lifecycle.ts` extended (2026-07-14)**: verification-only session, no new features, no schema changes. Extended the script (still can't import `lib/notify.ts`/`lib/actions/*.ts` directly — they transitively hit `server-only` and `next/headers`/`next/cache`, none of which function outside a live Next.js request, the same constraint that already shaped every other step; new coverage mirrors DB effects the same way the existing steps do) with: both review directions on a completed order, duplicate/non-participant/non-completed-order rejections, and an exact-value assertion that `creator_profiles.rating_avg`/`rating_count` and the gig's `avg_rating` match the actual inserted rating (not just non-null) — confirming `submitReview`'s recompute is full-aggregate-from-reviews (a fresh `SELECT`-then-`UPDATE` each time), not incremental, so no code change was needed (the task's fix was conditional on incremental; noting for the record that the `SELECT`-then-`UPDATE` pair is still two round-trips, not one atomic statement, so a narrow concurrent-write race is theoretically possible — a different, milder risk than the incremental-drift failure mode the task was checking for, and not something this session was asked to close). Also added the full payout request/process flow (creator submits, negative checks that creator/brand/an unrelated second brand can't touch or even see someone else's payout via RLS, admin processes it, ledger reconciles exactly against the order's price/commission snapshot) and notification assertions after every lifecycle event (escrow confirm, delivery submit/approve, order completion, escrow release, both reviews, payout processed) — each checks the stored `title`/`body` against `messages/{locale}.json` read directly off disk for the recipient's *own* locale (test creator is `ar`, test brand is `fr`, proving recipient-locale resolution) and that the recipient can read it while an unrelated party cannot. Ran the complete script twice in a row against the live project: **all 41 steps passed both times** with no fixes required (unlike the prior two verification sessions, which each found and fixed real bugs) — teardown correctly resets `creator_profiles.rating_avg`/`rating_count` between runs (confirmed via `pg_constraint`: `reviews.order_id` cascades from `orders`; `payouts`/`notifications` don't cascade from anything else torn down, since the test users themselves are persistent fixtures never deleted, so both got explicit teardown cleanup this session). `get_advisors` re-run after: unchanged, still zero findings beyond the two accepted WARNs. Phase 3/4 headers below updated from "(Completed)" to "(Verified end-to-end 2026-07-14)" — that's the actual date this ran clean, not the date the features were built.

## Database

- Engine: **PostgreSQL 14+**, via **Supabase** (Postgres + Auth + Storage).
- The canonical schema is `supabase/migrations/*.sql`, applied in order —
  currently `0001_initial_schema.sql` (tables), `0002_rls_policies.sql`
  (RLS), `0003_portfolio_items.sql` (portfolio), `0004_storage.sql`
  (portfolio bucket), `0005_orders_escrow.sql` (receipts bucket +
  `confirm_escrow_payment`), `0006_fulfillment.sql` (`pending_admin_review`
  enum value), `0007_fulfillment_objects.sql` (deliverables bucket +
  `release_escrow_payment`), `0008_security_hardening.sql`,
  `0009_fix_escrow_rpc_guard.sql` (see below for both), `0010_notifications.sql`
  (the `notifications` table). All ten are applied to the live project.
  There is no standalone `schema.sql` draft anymore — don't recreate it.
- **Never hand-edit a migration file once it's been applied.** Schema changes
  are new files: `supabase/migrations/0011_*.sql`, etc. (Adding a value to an
  existing enum must be its own migration — Postgres can't use a new enum
  value in the same transaction that adds it; that's why 0006/0007 are split.)
- **`0008_security_hardening.sql`** closed the advisor WARNs found after
  0001–0007: `set_updated_at`/`prevent_column_updates` now `set search_path =
  ''` (no behavior change — neither body resolves an object name that
  search_path affects). The `portfolio` bucket's public-read SELECT policy on
  `storage.objects` was replaced with an owner-or-admin one, because it had no
  restriction beyond `bucket_id` and let anyone `.list()`/enumerate every
  creator's folder. This does **not** affect public viewing of individual
  files by direct URL — `portfolio` is a `public = true` bucket, and Supabase
  serves public-bucket object GETs straight off that flag, bypassing
  `storage.objects` RLS entirely; only the Storage API's `.list()` (which
  reads through this SELECT policy) was ever exposed. Verified via
  `get_advisors`: zero findings above the one accepted WARN below.
- **Accepted WARN: `citext` extension installed in `public`.** The advisor
  flags this because an extension in `public` is writable by anyone who can
  create objects there; the fix (move it to a dedicated schema) means
  recreating `users.email`'s type and touching every dependent policy/index,
  for a benefit that's mostly theoretical here (this project doesn't grant
  arbitrary object-creation in `public` to untrusted roles). Left as-is
  deliberately — don't "fix" this without discussing the migration cost first.
- **Accepted WARN: `auth_leaked_password_protection`.** HaveIBeenPwned
  checking on signup/password-change requires the Supabase Pro plan — not
  available on this project's current plan. Accepted for MVP; revisit when
  the project upgrades off the Free plan.
- TypeScript types for the schema live at [`lib/database.types.ts`](lib/database.types.ts),
  generated from the live project — never hand-edit it. Regenerate after
  every migration:
  `npx supabase gen types typescript --db-url "$SUPABASE_DB_URL" > lib/database.types.ts`
- IDs are UUIDs (`gen_random_uuid()`, via `pgcrypto`). Money is always stored
  as an **integer count of DZD** (no fractional dinars) — column names are
  suffixed `_dzd` to make units unambiguous; never store money as `numeric`
  or `float`.
- `users` is a single table with a `role` enum; `creator_profiles` and
  `brand_profiles` are 1:1 extension tables keyed on `users.id`. The DB does
  **not** enforce that a `creator_profiles` row's user has `role = 'creator'`
  — that invariant is app-level. Same for `brand_profiles`.
- A creator's portfolio is `portfolio_items` (many rows per creator, not a
  single link) — each row is either an uploaded video (`video_url` +
  `thumbnail_url`) or an external TikTok/IG link (`external_url`); a check
  constraint requires at least one. Ordered by `sort_order`. This replaced
  `creator_profiles.portfolio_url`, dropped in `0003_portfolio_items.sql`.
- Uploaded portfolio videos go in the `portfolio` Storage bucket, created in
  `0004_storage.sql` (public read, 100MB per-file limit, video/image MIME
  types only). Objects must live at `{creator_id}/{filename}` — RLS on
  `storage.objects` checks that path prefix against `auth.uid()`, so a
  creator can only write/delete inside their own folder. Buckets and their
  policies are schema, same as tables — **never create or configure one
  through the dashboard**; add a new migration instead.
- Order-time price/commission are **snapshotted onto the order row**
  (`price_dzd`, `commission_rate`, `commission_amount_dzd`,
  `creator_payout_dzd`, `revisions_included`) so later edits to a gig/package
  never retroactively change an existing order.
- `order_status_history` is an append-only audit log. Valid status
  transitions are a state machine enforced in application code, not by a DB
  constraint — check there before assuming a transition is legal.
- Money movement (escrow hold/release, refunds, commission, payouts) is
  recorded in `transactions`. Because payment is manual, every transaction
  carries `status` (`pending`/`confirmed`/`rejected`), `confirmed_by`, and
  `proof_image_url` — treat "money moved" as `status = 'confirmed'`, not
  merely "row exists."
- `creator_wallets` is a denormalized running balance, not the source of
  truth — it must be kept in sync with confirmed `transactions` whenever
  either is written. If you add a code path that touches money, update both
  in the same transaction (DB transaction, not the `transactions` table).
  It has no authenticated-role write policy at all — balance changes only
  ever happen via the service-role client (`confirm_escrow_payment`/
  `release_escrow_payment` RPCs, or `lib/actions/admin.ts`'s `processPayout`).
- `payouts` (a creator's withdrawal request to their CCP/BaridiMob account)
  is a distinct concept from a `transactions` row of `type = 'escrow_release'`
  — the latter moves funds from `pending_balance_dzd` to
  `available_balance_dzd` in the wallet; a `payouts` row is the creator then
  asking to actually withdraw from that available balance, processed by
  `processPayout` (`lib/actions/admin.ts`), not by either escrow RPC.
- `notifications` (added in `0010_notifications.sql`) is a per-user inbox,
  not a message queue — `title`/`body` are plain text, resolved and stored
  at creation time in the *recipient's* locale (see `lib/notify.ts`), not
  translation keys resolved at render time. INSERT has no policy for
  `authenticated`/`anon` at all (service-role only) — creating a
  notification always goes through `lib/notify.ts`'s `notify()`/
  `notifyAdmins()` helpers from trusted server code that already verified
  the underlying event happened; never let a user-facing form insert one
  directly.
- Multilingual UI text (French/Arabic/English) is **not** modeled as
  `_fr`/`_ar`/`_en` column pairs on user-generated content (gig titles,
  descriptions, messages, reviews) — creators write those in whichever
  language they choose. Only admin-curated lookup tables (`niches`,
  `languages`) have `name_fr`/`name_ar`/`name_en` columns. UI locale/RTL is a
  `users.locale` preference (`fr`/`ar`/`en`) plus app-layer i18n, not a schema
  concern — RTL layout applies only when `locale = 'ar'`.
- A gig's **content language** (what language the delivered video is spoken/
  written in — used for the "browse by language" filter) is unrelated to UI
  locale: it's just rows in `languages` joined via `gig_languages`, so adding
  a new content language (e.g. Darja) is a data change, not a migration.
- `gigs.base_price_dzd`, `avg_rating`, `orders_count`, and the rating fields
  on `creator_profiles` are denormalized for fast browse/sort. Anything that
  writes a new package price, review, or completed order must update the
  corresponding denormalized field(s).

## Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS v4**, npm as the package
  manager. Tailwind v4 is configured CSS-first (`@import "tailwindcss"` in
  `app/globals.css`) — there is no `tailwind.config.js`.
- **next-intl** for i18n, locales `fr` (default) and `ar`, routed as
  `/{locale}/...` via `proxy.ts`. Locale/message config lives in `i18n/`
  (`routing.ts`, `navigation.ts`, `request.ts`); UI strings live in
  `messages/{locale}.json`.
- **Supabase** for Postgres, Auth, and (later) Storage/Realtime. Realtime
  transport for chat is not yet decided beyond "probably Supabase Realtime on
  the `messages` table" — don't assume it's wired up before checking.
- No ORM — queries go through the Supabase JS client (`@supabase/supabase-js` /
  `@supabase/ssr`), typed against `lib/database.types.ts`.

Run `npx <cmd>` for one-off CLI tools (`supabase`, etc.) rather than assuming
global installs — see "Running locally" below for the exact commands.

### Supabase clients — which one to use

- [`lib/supabase/client.ts`](lib/supabase/client.ts) — browser client, for
  Client Components. Subject to RLS.
- [`lib/supabase/server.ts`](lib/supabase/server.ts) — server client, for
  Server Components/Actions/Route Handlers. Subject to RLS. Use this for
  anything done on behalf of the signed-in user.
- [`lib/supabase/admin.ts`](lib/supabase/admin.ts) — service-role client.
  **Bypasses RLS entirely.** Only call from code that has already verified
  the caller is an admin (see the `(admin)` layout for the pattern). It's
  guarded with the `server-only` package so an accidental client-side import
  fails the build instead of leaking the service-role key.
- RLS policies **are** live (`0002_rls_policies.sql`, applied), keyed on
  `auth.uid()` plus the `is_admin()` / `current_user_role()` helpers. The
  `(dashboard)`/`(admin)` layouts still do app-level auth/role checks too;
  that's defense in depth, not a substitute — keep both.
- **Money-moving RPCs are `SECURITY DEFINER` and locked down.**
  `confirm_escrow_payment` / `release_escrow_payment` bypass RLS by design, so
  their default `PUBLIC` EXECUTE grant is revoked and only `service_role` may
  call them (plus an in-function guard and `set search_path = ''`). The guard
  checks `current_setting('role', true) = 'service_role' or is_admin()` —
  **not** `current_user`, which inside a `SECURITY DEFINER` function reflects
  the function's *owner*, not the caller, and would reject every real caller
  (this was a real bug, fixed in `0009_fix_escrow_rpc_guard.sql` — see
  History). Call them **only** through the service-role admin client after
  verifying the caller is an admin (see `lib/actions/admin.ts`). Don't grant
  them back to `authenticated` — that
  reopens a privilege-escalation hole (any brand could confirm their own
  escrow).

### Auth

- Identity is Supabase Auth (email/password for now). `public.users` is a
  profile table keyed 1:1 with `auth.users` — **`public.users.id` must always
  be set explicitly to the Supabase Auth user's id** (`data.user.id` from
  `signUp`), never left to its `gen_random_uuid()` default, or `auth.uid()`
  based RLS policies (added later) will never match.
- Signup (`lib/auth/actions.ts`) picks a role (`creator` or `brand` —
  `admin` accounts are provisioned manually, not self-service) and inserts
  the `public.users` row right after `supabase.auth.signUp()`.
- `app/auth/callback/route.ts` handles the email-confirmation redirect and
  deliberately lives outside `app/[locale]/` — Supabase's email link must
  point at a fixed URL, so `proxy.ts`'s matcher explicitly excludes
  `/auth`.
- Session refresh happens in `proxy.ts` (Next.js 16 renamed the `middleware`
  file convention to `proxy`), composed with the next-intl locale-routing
  logic. If you touch either, keep both halves — dropping
  the Supabase half causes silent session expiry; dropping the next-intl half
  breaks locale routing.

### Route structure

`app/[locale]/` holds three route groups (no URL segment of their own, just
layout boundaries):

- `(public)` — home, `/gigs` (browse), `/login`, `/signup`. No auth required.
- `(dashboard)` — `/dashboard` and (later) everything creator/brand-specific.
  Its layout redirects to `/login` if there's no session.
- `(admin)` — `/admin` and (later) escrow confirmation, disputes, payouts.
  Its layout redirects non-admins to `/dashboard`.

All three currently render the same `<SiteHeader>` (top nav + `LocaleSwitcher`).
When `(dashboard)`/`(admin)` need different chrome (sidebar, role-specific
nav), give them their own header rather than branching inside `SiteHeader`.

### Internationalization & RTL

- `app/[locale]/layout.tsx` sets `<html lang={locale} dir={...}>`; `ar` is
  the only RTL locale so far (see `RTL_LOCALES` in that file — extend the set
  if a second RTL locale is ever added).
- Tailwind v4 ships logical-property utilities by default — `ms-*`/`me-*`
  (margin-inline-start/end), `ps-*`/`pe-*` (padding-inline-start/end),
  `text-start`/`text-end`, `start-*`/`end-*`, `rounded-s-*`/`rounded-e-*`,
  etc. **Never use physical one-sided utilities** (`ml-*`, `mr-*`, `pl-*`,
  `pr-*`, `text-left`, `text-right`, `left-*`, `right-*`) — they don't flip
  for `ar` and will visually break RTL. Symmetric utilities (`px-*`, `py-*`,
  `mx-*`) are fine as-is since both sides get the same value.
- Add new UI strings to **both** `messages/fr.json` and `messages/ar.json` in
  the same commit — there's no fallback locale at runtime.
- Supabase Auth error messages (`error.message`) are shown to the user
  as-is in English and are not localized — there's no error-code-to-message
  mapping layer yet. Acceptable for Phase 1; revisit before launch.
- **Static/ISR pages need `setRequestLocale(locale)` in every layout in their
  route group, not just the root layout.** next-intl's static-rendering
  support is a request-scoped cache (`getCachedRequestLocale()` in
  `next-intl/server`): the first call wins, and everything downstream reuses
  it. If a shared layout doesn't call it before rendering children, those
  children's `getTranslations()`/`useTranslations()` calls fall through to
  reading `headers()` directly — which is a Next.js Dynamic API and silently
  taints the **entire route** as server-rendered-on-demand (`ƒ` in the build
  output), even with an `export const revalidate = ...` on the page. This
  bit the homepage: `app/[locale]/(public)/layout.tsx` renders `<SiteHeader>`
  / `<Footer>` (both call `getTranslations`) but wasn't itself calling
  `setRequestLocale`, so `/[locale]` built as `ƒ` despite `revalidate = 300`
  on `page.tsx`. Fixed by making that layout `async`, awaiting `params`, and
  calling `setRequestLocale(locale)` before returning JSX — confirmed via
  `next build`'s route table, which now shows `● /[locale]` (SSG,
  `Revalidate 5m`). If you add a new route group and want its pages
  static, give its layout the same treatment.
- `SiteHeader` deliberately does **not** check auth session server-side
  (no `createClient()`/`cookies()` call) — that would force every route
  using it dynamic, for the same reason as above. The auth-dependent nav
  (dashboard/logout/notifications vs. login/signup links) lives in
  `components/site-header-auth.tsx`, a Client Component that reads the
  session via the browser Supabase client after hydration. Anonymous
  visitors (the common case on public pages) see the logged-out links with
  no flash; logged-in users see a brief swap after mount. Don't move this
  check back to the server without re-checking the homepage's build output.

## Conventions

- All monetary amounts: integer DZD, `_dzd` suffix, never float.
- All timestamps: `timestamptz`, UTC.
- Prefer extending the existing enum types (`order_status`, `gig_status`,
  etc.) over adding new boolean/status columns.
- Manual payment confirmation is a deliberate, temporary design choice (no
  payment gateway integration yet) — don't "fix" it into an automated flow
  without being asked; the admin-confirms-transfer step is load-bearing until
  a real payment gateway is integrated.

## Known follow-ups

- `public.users.password_hash` is a leftover from before Supabase Auth was
  chosen as the identity provider — Supabase stores real credentials in
  `auth.users`, so this column is never read and is filled with a constant
  placeholder (`MANAGED_PASSWORD_PLACEHOLDER` in `lib/auth/actions.ts`) on
  signup. Since `0001_initial_schema.sql` can't be hand-edited, drop the
  column in a `0002_*.sql` migration when convenient.
- All nine migrations (`0001`–`0009`) are applied to the live project. Direct
  `supabase db push --db-url` currently fails to reach the DB host (DNS), so
  new migrations are applied via the claude.ai Supabase connector's
  `apply_migration`; the local migration-history table may therefore lag the
  remote one. `get_advisors` (security) was last re-run 2026-07-13 after
  0009: zero findings except the accepted `citext` WARN and a newly-observed
  `auth_leaked_password_protection` WARN (an Auth project setting, not
  something a migration can fix — see the History section). See the Database
  section above).
- `.env.local` has real values for everything except the project-scoped
  MCP server's own auth: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and
  `SUPABASE_DB_URL` are all filled in. `SUPABASE_JWKS_URL` is also present
  but unused by any code yet.
- Two separate Supabase MCP integrations exist and are in different auth
  states: the project-scoped server in `.mcp.json`
  (`mcp.supabase.com/mcp?project_ref=...`) still needs interactive
  authentication (`claude mcp` / `/mcp`); the account-level "claude.ai
  Supabase" connector is already authenticated and was used to generate
  `lib/database.types.ts` via its `generate_typescript_types` tool. Prefer
  the CLI (`npx supabase ...`) for anything the connector doesn't expose,
  e.g. pushing new migrations.
- `lib/database.types.ts` is now generated from the live project (no longer
  hand-authored) — regenerate after every schema change with
  `npx supabase gen types typescript --linked` (once the CLI is linked/
  authenticated) or via the claude.ai Supabase connector's
  `generate_typescript_types` tool.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in real values, see below
npm run dev                  # http://localhost:3000 -> redirects to /fr
```

`.env.local` (get these from the Supabase dashboard → Project Settings → API,
and → Database → Connection string):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<secret-key>
SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

Once a project exists, also:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push                                   # applies supabase/migrations/*.sql in order
npx supabase gen types typescript --db-url "$SUPABASE_DB_URL" > lib/database.types.ts
```

And in the Supabase dashboard, set **Authentication → URL Configuration →
Redirect URLs** to include `http://localhost:3000/auth/callback` (and the
production equivalent later), or email confirmation links won't come back to
the app correctly.

## Production Deployment

### Environment variables — what Vercel actually needs

Set these in **Vercel → Project → Settings → Environment Variables**, scoped
to **Production** (and Preview, if you want preview deployments to hit the
same live Supabase project — there's no separate staging project yet):

| Variable | Required in Vercel? | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Yes** | Same page — "Publishable key" |
| `SUPABASE_SECRET_KEY` | **Yes** — mark it "Sensitive" in Vercel's UI | Same page — "Secret key". **Never** prefix with `NEXT_PUBLIC_`. |
| `SUPABASE_DB_URL` | **No** — CLI/dev-only (`supabase gen types`), never read by the running app | — |
| `SUPABASE_JWKS_URL` | **No** — present in `.env.example` for a future feature, unused by any code today | — |

**Service-role exposure audit (done 2026-07-15, re-run this after adding any
new file that imports `lib/supabase/admin.ts`):** every file that imports it
is either a `"use server"` Server Action (`lib/actions/admin.ts`,
`lib/actions/fulfillment.ts`, `lib/actions/review.ts` — Next.js compiles
these to server-only RPC stubs, the function body never reaches the client
bundle) or carries its own `import "server-only"` guard
(`lib/supabase/admin.ts` itself, `lib/notify.ts`) that hard-fails the build
if a client component ever imports it. `grep -rn "SECRET_KEY"` across
`*.ts`/`*.tsx` turns up exactly two references: `lib/supabase/admin.ts`
(server-only-guarded) and `scripts/verify-lifecycle.ts` (a standalone Node
script run via `npx tsx`, never imported by app code, never bundled). No
`NEXT_PUBLIC_`-prefixed reference to the secret key exists anywhere. Command
to re-run this check yourself:
```bash
grep -rn "supabase/admin" --include="*.ts" --include="*.tsx" .
grep -rn "SECRET_KEY" --include="*.ts" --include="*.tsx" .
```
Every result from the first command should be a `"use server"` file or a
`server-only`-guarded one; every result from the second should be one of the
two files named above.

### Deploy checklist (first time)

1. Push this repo to a GitHub repo you control.
2. In Vercel: **New Project** → import that repo → framework preset
   "Next.js" (auto-detected, no changes needed — this project has no custom
   `next.config.ts` beyond the `next-intl` plugin wrapper).
3. Add the three required env vars above (Production **and** Preview scope).
4. Deploy. Note the resulting domain (`https://<project>.vercel.app`, or your
   custom domain once attached).
5. **Supabase dashboard → Authentication → URL Configuration**:
   - **Site URL**: your production domain (e.g. `https://your-domain.com`).
   - **Redirect URLs**: add `https://your-domain.com/auth/callback` alongside
     the existing `http://localhost:3000/auth/callback` (keep both — you'll
     still want local dev to work). This is the exact same mechanism
     documented under "Running locally" above; production is just another
     entry in the same allow-list, not a different mechanism.
6. Re-test signup end-to-end against the deployed URL: the email
   confirmation link must land back on `/auth/callback` on the *production*
   domain, not localhost — that only works once step 5 is done.
7. Enable **Vercel Analytics** in the Vercel dashboard for this project
   (Project → Analytics tab) — the `@vercel/analytics` package is already
   wired into the root layout; the dashboard toggle is what actually turns
   on data collection.

### What this session could NOT do for you

Actually creating the Vercel project, connecting a GitHub remote, and
authenticating either service requires interactive login this environment
can't perform (same class of blocker as the Supabase MCP server's OAuth
flow, documented under Known follow-ups). Steps 1–2 and 5 above are yours to
do by hand; everything else (env var values, checklist, code) is prepared.

## Admin Operations Runbook

For the human admin running day-to-day operations — no technical background
assumed. All four flows below are at `/admin/...` (sign in with an admin
account; non-admins are redirected to `/dashboard`).

### Confirm an escrow payment

A brand has placed an order and uploaded a screenshot of their CCP/BaridiMob
transfer. Nothing happens for that order until you confirm the money
actually arrived.

1. Go to **`/admin/transactions`**.
2. Each row is a pending payment: the order it belongs to, the amount, the
   payment method (CCP/BaridiMob), and a **"View Receipt"** link — click it
   to open the transfer screenshot in a new tab and check it against your
   own CCP/BaridiMob account.
3. If the transfer is real and matches the amount: click **"Confirm
   Payment"**. The order moves to *in progress*, and the creator can start
   working. Both the brand and creator get notified automatically.
4. If it doesn't match or looks fraudulent: don't click confirm — reach out
   to the brand outside the platform first. (There's no "reject" button
   here yet — a pending row that's never confirmed simply blocks that order
   from starting, which is the safe default.)

**Related, later in the same order's life — releasing escrow.** Once a
brand has accepted a finished delivery, go to **`/admin/releases`** and
confirm the release there too. This is a *different* step from confirming
the payment above: confirming moves the brand's money into escrow at the
*start* of the order; releasing moves it out of escrow to the creator's
in-app balance at the *end*. Both are manual on purpose — see "Conventions"
below.

### Run QC on a delivery

A creator has uploaded their finished video. It's held here — the brand
can't see it yet — until you check it's an actual, watchable video and not
garbage/wrong file/empty upload.

1. Go to **`/admin/deliveries`**.
2. Each row has a link/preview to the uploaded file and the creator's note
   (if any). Watch it.
3. If it's a real, watchable video: click **"Approve"**. The order moves to
   *delivered*, and the brand can now see it and gets notified — this is
   what actually unlocks the brand's access, not the creator's upload.
4. If it's broken, empty, or clearly not what was ordered: click **"Reject"**
   and write a short reason. The order goes to *revision requested* and the
   creator gets notified with your note, prompting them to redeliver.

### Process a payout request

A creator has asked to withdraw their available balance to their CCP or
BaridiMob account. This is a separate step from confirming escrow — by the
time a payout request exists, the platform already owes the creator that
money; this is you actually sending it to their real bank account outside
the platform, then recording that you did.

1. Go to **`/admin/payouts`**.
2. Each row shows the creator's name, the amount, their payout method, and
   their account details (CCP account number or BaridiMob RIP).
3. **Actually send the money** via CCP/BaridiMob transfer to that account,
   outside this app — there's no automated transfer.
4. Once sent: click **"Mark as paid"**. This records who processed it and
   when, and reduces the creator's available balance by that amount — do
   this only *after* you've actually sent the money, not before.
5. If you're not going to pay it (e.g. suspicious account, creator asked to
   cancel): click **"Reject"** instead — the creator keeps their balance and
   can request again later.

### Deactivate a gig

A creator's gig needs to come down — policy violation, creator request, or
anything else.

1. Go to **`/admin/gigs`**.
2. Find the gig (creator name + title are shown). Click **"Deactivate"**.
3. The gig immediately stops showing up in public browse/search. Existing
   orders already placed against it are unaffected — this only stops *new*
   orders.
4. To bring it back later: same page, click **"Reactivate"** on that gig.

## Completed Progress & Implementation History

### Phase 1: Core Foundation & Setup
- Initialized Next.js 16 App Router project with TypeScript, Tailwind CSS v4, and `next-intl` i18n (`fr`, `ar`, `en`).
- Applied initial schema migrations:
  - `0001_initial_schema.sql`: Primary table definitions and relationships.
  - `0002_rls_policies.sql`: Row-Level Security policies across all tables.
  - `0003_portfolio_items.sql`: Creator portfolio items support with constraints.
- Generated canonical TypeScript definitions in `lib/database.types.ts`.
- Configured Supabase Auth clients (`client.ts`, `server.ts`, `admin.ts`) and Next.js session middleware (`proxy.ts`).

### Phase 2: Creator Profiles & Gigs (Completed)
- **Step 0 — Storage Bucket**: Applied `0004_storage.sql` to deploy the `portfolio` public bucket (100MB size limit, `video/*` and `image/*` MIME types) with path RLS prefix checking (`{creator_id}/{filename}`).
- **Step 1 — Creator Onboarding & Profile Management**:
  - Built `CreatorProfileForm` ([`components/creator/profile-form.tsx`](components/creator/profile-form.tsx)) to manage bio, single niche selection, years of experience, and payout accounts (`ccp` / `baridimob` methods) writing to `creator_payout_accounts`.
  - Built `PortfolioManager` ([`components/creator/portfolio-manager.tsx`](components/creator/portfolio-manager.tsx)) enforcing either/or portfolio sources (direct upload to `portfolio` bucket or external TikTok/IG links), displaying items, and supporting deletion/sorting.
- **Step 2 — Gig Creation & Management**:
  - Implemented `GigForm` ([`components/creator/gig-form.tsx`](components/creator/gig-form.tsx)) using `react-hook-form` and Zod validation in `lib/validation/gig.ts`.
  - Configured 3 mandatory packages (`basic`, `standard`, `premium`) with integer DZD price enforcement, delivery days, revision counts, and feature lists.
  - Created routes for gig listing, creation ([`app/[locale]/(dashboard)/dashboard/gigs/new/page.tsx`](app/[locale]/(dashboard)/dashboard/gigs/new/page.tsx)), and editing ([`app/[locale]/(dashboard)/dashboard/gigs/[id]/edit/page.tsx`](app/[locale]/(dashboard)/dashboard/gigs/[id]/edit/page.tsx)).
- **Step 3 — Public Browse & Gig Detail**:
  - Built server-rendered public browse grid ([`app/[locale]/(public)/gigs/page.tsx`](app/[locale]/(public)/gigs/page.tsx)) with responsive mobile-first `GigCard` components and filter controls ([`components/gigs/gig-filters.tsx`](components/gigs/gig-filters.tsx)) for niche, language, price range, and delivery speed.
  - Built public gig detail view ([`app/[locale]/(public)/gigs/[id]/page.tsx`](app/[locale]/(public)/gigs/[id]/page.tsx)) featuring an interactive 3-tier package selector, creator card, portfolio clip previews, and disabled Phase 3 order placeholder.
- **Step 4 — Localization & Seed Data**:
  - Synchronized dictionary keys across [`messages/fr.json`](messages/fr.json) and [`messages/ar.json`](messages/ar.json).
  - Maintained RTL layout integrity using Tailwind logical-property utility classes (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`, `start-`, `end-`).
  - Populated [`supabase/seed.sql`](supabase/seed.sql) with 8 active niches, languages, and 3 fake creators with sample portfolios and multi-package gigs.

### Phase 3: Orders, Escrow, and Admin Verification (Verified end-to-end 2026-07-14)
- **Step 0 — Storage & RPC**: Applied `0005_orders_escrow.sql` to deploy the `receipts` private bucket (with restrictive RLS) and the `confirm_escrow_payment` RPC for atomic order/transaction/wallet updates.
- **Step 1 — Order Actions & Commission**: Built the `createOrder` Server Action containing tier-based commission logic (`1000 DZD` if `< 10,000`, `10%` otherwise) wrapped strictly in `Math.round()` to satisfy `_dzd` integer columns constraints.
- **Step 2 — Checkout & Payment UIs**:
  - Connected the gig detail view to a new Checkout flow at `/[locale]/dashboard/checkout/[gigId]/[packageId]` which uses `CheckoutForm` to capture requirements.
  - Implemented the manual payment proof upload via `PaymentProofForm` at `/[locale]/dashboard/orders/[orderId]/pay`.
- **Step 3 — Admin Escrow Dashboard**: Created `/admin/transactions` where admins can review pending manual payments and securely view receipts (via temporary signed URLs) before executing the `confirmEscrowHold` Server Action.
- **Step 4 — Localization**: Added the `checkout` translation dictionary keys to `fr.json` and `ar.json` and verified Next.js build compliance.

### Phase 4: Fulfillment, Real-time Chat, and Admin QC (Verified end-to-end 2026-07-14)
- **Step 0 — Migrations & Types**: Added `pending_admin_review` to `order_status` (`0006_fulfillment.sql`), the private `deliverables` bucket with brand-lockout-during-review RLS, and the `release_escrow_payment` RPC (`0007_fulfillment_objects.sql`). NOTE (corrected 2026-07-13): these migrations were initially only scaffolded on disk and `lib/database.types.ts` was hand-patched to match, which hid the fact that they were never applied to the live DB. They have since been applied and the types regenerated from the live project — do not hand-patch the types again; regenerate them.
- **Step 1 — Real-time Workspace**: Built the `OrderWorkspace` dynamically serving either the Brand or Creator. It leverages a Supabase Realtime-powered `RealtimeChat` component that securely streams directly from the `messages` table.
- **Step 2 — Fulfillment Lifecycle**: 
  - Creators use `DeliveryForm` to upload deliverable videos which shifts the order status to `pending_admin_review`.
  - Brands use `ReviewDelivery` (only unlocked after Admin approval) to Accept, ask for Revisions (respecting the gig's max revision limit), or Dispute. 
- **Step 3 — Admin QC & Escrow Release UI**: 
  - Added the `/admin/deliveries` dashboard for Admins to view pending deliverables and `adminApproveDelivery` / `adminRejectDelivery`.
  - Added the `/admin/releases` dashboard to execute `confirmEscrowRelease` and transfer funds to the Creator's wallet once a Brand accepts the delivery.
- **Step 4 — Localization**: Translated the entire workspace workflow and UI strings into `fr.json` and `ar.json`.
