import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNiches, getLanguages } from "@/lib/data/lookups";
import { GigForm } from "@/components/creator/gig-form";

export default async function NewGigPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "creator") {
    redirect({ href: "/dashboard", locale });
    return null;
  }

  const [niches, languages] = await Promise.all([
    getNiches(),
    getLanguages(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
      <GigForm userId={user.id} niches={niches} languages={languages} />
    </div>
  );
}
