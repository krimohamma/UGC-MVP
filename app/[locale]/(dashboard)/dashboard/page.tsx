import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getNiches } from "@/lib/data/lookups";
import {
  getCreatorProfile,
  getCreatorPayoutAccount,
  getCreatorPortfolio,
  getCreatorWallet,
  getCreatorPayouts,
} from "@/lib/data/creator";
import { getCreatorGigs } from "@/lib/data/gigs";
import { CreatorProfileForm } from "@/components/creator/profile-form";
import { PortfolioManager } from "@/components/creator/portfolio-manager";
import { PayoutRequest } from "@/components/creator/payout-request";
import { GigCard } from "@/components/gigs/gig-card";
import { formatDzd } from "@/lib/format";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("dashboard");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userProfile } = await supabase
    .from("users")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  const isCreator = userProfile?.role === "creator";

  if (!isCreator) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12 text-start">
        <h1 className="text-2xl font-bold">{t("brandWelcome")}, {userProfile?.full_name}</h1>
        <p className="text-muted-foreground">{t("brandSubtitle")}</p>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4 max-w-md">
          <h2 className="text-lg font-semibold">{t("exploreCreators")}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("brandDescription")}
          </p>
          <Link
            href={`/${locale}/gigs`}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {t("browseGigsBtn")}
          </Link>
        </div>
      </div>
    );
  }

  // Fetch creator data parallelly
  const [profile, payoutAccount, portfolioItems, creatorGigs, niches, wallet, payoutHistory] =
    await Promise.all([
      getCreatorProfile(user.id),
      getCreatorPayoutAccount(user.id),
      getCreatorPortfolio(user.id),
      getCreatorGigs(user.id),
      getNiches(),
      getCreatorWallet(user.id),
      getCreatorPayouts(user.id),
    ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold text-start">
            {t("creatorWelcome")}, {userProfile.full_name} 👋
          </h1>
          <p className="text-sm text-muted-foreground text-start mt-1">
            {t("creatorSubtitle")}
          </p>
        </div>
        <Link
          href={`/${locale}/dashboard/gigs/new`}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm transition-opacity"
        >
          + {t("createNewGig")}
        </Link>
      </div>

      {/* Creator Active Gigs List */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-start">{t("yourGigs")} ({creatorGigs.length})</h2>
        </div>
        {creatorGigs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-3">
            <p>{t("noGigsYet")}</p>
            <Link
              href={`/${locale}/dashboard/gigs/new`}
              className="text-xs font-semibold text-primary underline"
            >
              {t("createFirstGig")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {creatorGigs.map((gig) => (
              <div key={gig.id} className="relative flex flex-col justify-between">
                <GigCard gig={{ ...gig, users: userProfile }} locale={locale} />
                <div className="mt-2 flex justify-between items-center px-1 text-xs">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    gig.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {gig.status}
                  </span>
                  <Link
                    href={`/${locale}/dashboard/gigs/${gig.id}/edit`}
                    className="text-primary font-semibold hover:underline"
                  >
                    {t("editGig")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Onboarding & Profile Settings */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CreatorProfileForm
          profile={profile}
          payoutAccount={payoutAccount}
          niches={niches}
        />
        <PortfolioManager userId={user.id} items={portfolioItems} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PayoutRequest
          availableBalanceDzd={wallet.available_balance_dzd}
          pendingBalanceDzd={wallet.pending_balance_dzd}
          payoutAccountId={payoutAccount?.id ?? null}
          history={payoutHistory}
        />
      </section>
    </div>
  );
}
