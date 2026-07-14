import "server-only";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Create an in-app notification. Not a Server Action — a plain helper
 * imported by other trusted server code (Server Actions, RPC-calling admin
 * flows) right after they've already verified the event actually happened.
 *
 * `notifications.title`/`.body` are plain text columns (not translation
 * keys — the bell component just renders them), so the text is resolved
 * HERE, in the *recipient's* own `users.locale` (not the actor's current
 * request locale — the person being notified may be signed in from a
 * different locale than whoever triggered the event). `type` doubles as
 * the key under `messages.notifications.events.<type>` — add both a
 * `title` and `body` there for every new type.
 *
 * Uses the service-role client because `notifications` INSERT has no policy
 * for authenticated/anon (service-role only, by design — see
 * 0010_notifications.sql): a user notifying themselves of an event they
 * didn't actually experience isn't something RLS should ever permit.
 */
export async function notify(params: {
  userId: string;
  type: string;
  bodyParams?: Record<string, string | number>;
  linkUrl?: string;
}) {
  const admin = createAdminClient();

  const { data: recipient } = await admin
    .from("users")
    .select("locale")
    .eq("id", params.userId)
    .single();
  const locale = recipient?.locale ?? "fr";

  const t = await getTranslations({ locale, namespace: `notifications.events.${params.type}` });

  const { error } = await admin.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    title: t("title"),
    body: t("body", params.bodyParams),
    link_url: params.linkUrl ?? null,
  });
  if (error) {
    // Never let a notification failure break the caller's actual business
    // action (e.g. escrow confirmation) — log and move on.
    console.error(`Failed to create notification (type=${params.type}) for user ${params.userId}:`, error);
  }
}

/** Notify every admin user — for events with no single natural recipient. */
export async function notifyAdmins(params: {
  type: string;
  bodyParams?: Record<string, string | number>;
  linkUrl?: string;
}) {
  const admin = createAdminClient();
  const { data: admins } = await admin.from("users").select("id").eq("role", "admin");
  await Promise.all((admins ?? []).map((a) => notify({ ...params, userId: a.id })));
}
