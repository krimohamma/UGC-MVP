import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNiches, getLanguages } from "@/lib/data/lookups";
import { getGigById } from "@/lib/data/gigs";
import { GigForm } from "@/components/creator/gig-form";

export default async function EditGigPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const gig = await getGigById(id);
  if (!gig || gig.creator_id !== user.id) {
    notFound();
  }

  const [niches, languages] = await Promise.all([
    getNiches(),
    getLanguages(),
  ]);

  const initialData = {
    id: gig.id,
    title: gig.title,
    description: gig.description,
    niche_id: gig.niche_id,
    status: gig.status as "draft" | "active" | "paused" | "archived",
    cover_media_url: gig.cover_media_url,
    language_codes: gig.gig_languages?.map((l: any) => l.language_code) || [],
    packages: gig.gig_packages?.map((p: any) => ({
      tier: p.tier as "basic" | "standard" | "premium",
      title: p.title,
      description: p.description,
      price_dzd: p.price_dzd,
      delivery_days: p.delivery_days,
      revisions_included: p.revisions_included,
      features: p.features || [],
    })) || [],
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
      <GigForm
        userId={user.id}
        niches={niches}
        languages={languages}
        initialData={initialData}
      />
    </div>
  );
}
