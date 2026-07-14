import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Must happen here, as early as possible in this subtree, not just in the
  // root layout — next-intl's static-rendering support is request-cache
  // based (see next-intl/server's setRequestLocale docs) and Server
  // Components below this point (SiteHeader, Footer, the page) can render
  // before the root layout's own call lands, hitting the dynamic headers()
  // fallback and silently tainting the whole route as server-rendered.
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}
