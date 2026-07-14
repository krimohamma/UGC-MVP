import { notFound } from "next/navigation";
import { getGigById } from "@/lib/data/gigs";
import { GigDetailView } from "@/components/gigs/gig-detail-view";

export default async function GigDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const gig = await getGigById(id);

  if (!gig) {
    notFound();
  }

  return <GigDetailView gig={gig} locale={locale} />;
}
