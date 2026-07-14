"use server";

import { createClient } from "@/lib/supabase/server";
import { gigSchema, type GigInput } from "@/lib/validation/gig";
import { revalidatePath } from "next/cache";

export async function createGig(input: GigInput) {
  const parsed = gigSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Calculate base_price_dzd as minimum package price
  const base_price_dzd = Math.min(...parsed.packages.map((p) => p.price_dzd));

  // 1. Insert gig
  const { data: gig, error: gigError } = await supabase
    .from("gigs")
    .insert({
      creator_id: user.id,
      niche_id: parsed.niche_id,
      title: parsed.title,
      description: parsed.description,
      status: parsed.status,
      cover_media_url: parsed.cover_media_url || null,
      base_price_dzd,
    })
    .select("id")
    .single();

  if (gigError || !gig) {
    console.error("Failed to create gig:", gigError);
    return { success: false, error: gigError?.message || "Creation failed" };
  }

  // 2. Insert gig_languages
  const langRows = parsed.language_codes.map((code) => ({
    gig_id: gig.id,
    language_code: code,
  }));
  const { error: langError } = await supabase
    .from("gig_languages")
    .insert(langRows);

  if (langError) {
    console.error("Failed to set gig languages:", langError);
  }

  // 3. Insert 3 gig_packages
  const pkgRows = parsed.packages.map((pkg) => ({
    gig_id: gig.id,
    tier: pkg.tier,
    title: pkg.title,
    description: pkg.description,
    price_dzd: Math.floor(pkg.price_dzd),
    delivery_days: pkg.delivery_days,
    revisions_included: pkg.revisions_included,
    features: pkg.features,
  }));

  const { error: pkgError } = await supabase
    .from("gig_packages")
    .insert(pkgRows);

  if (pkgError) {
    console.error("Failed to insert gig packages:", pkgError);
    return { success: false, error: pkgError.message };
  }

  revalidatePath("/[locale]/gigs", "layout");
  revalidatePath("/[locale]/dashboard", "layout");
  return { success: true, gigId: gig.id };
}

export async function updateGig(gigId: string, input: GigInput) {
  const parsed = gigSchema.parse(input);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const base_price_dzd = Math.min(...parsed.packages.map((p) => p.price_dzd));

  // 1. Update gig main record
  const { error: gigError } = await supabase
    .from("gigs")
    .update({
      niche_id: parsed.niche_id,
      title: parsed.title,
      description: parsed.description,
      status: parsed.status,
      cover_media_url: parsed.cover_media_url || null,
      base_price_dzd,
    })
    .eq("id", gigId)
    .eq("creator_id", user.id);

  if (gigError) {
    console.error("Failed to update gig:", gigError);
    return { success: false, error: gigError.message };
  }

  // 2. Update languages (delete old, insert new)
  await supabase.from("gig_languages").delete().eq("gig_id", gigId);
  const langRows = parsed.language_codes.map((code) => ({
    gig_id: gigId,
    language_code: code,
  }));
  await supabase.from("gig_languages").insert(langRows);

  // 3. Update packages
  for (const pkg of parsed.packages) {
    await supabase
      .from("gig_packages")
      .upsert(
        {
          gig_id: gigId,
          tier: pkg.tier,
          title: pkg.title,
          description: pkg.description,
          price_dzd: Math.floor(pkg.price_dzd),
          delivery_days: pkg.delivery_days,
          revisions_included: pkg.revisions_included,
          features: pkg.features,
        },
        { onConflict: "gig_id, tier" }
      );
  }

  revalidatePath("/[locale]/gigs", "layout");
  revalidatePath("/[locale]/dashboard", "layout");
  return { success: true };
}

export async function deleteGig(gigId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("gigs")
    .delete()
    .eq("id", gigId)
    .eq("creator_id", user.id);

  if (error) {
    console.error("Failed to delete gig:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/[locale]/gigs", "layout");
  revalidatePath("/[locale]/dashboard", "layout");
  return { success: true };
}
