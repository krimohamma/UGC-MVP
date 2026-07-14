import { redirect } from "@/i18n/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  if (profile?.role !== "admin") {
    redirect({ href: "/dashboard", locale });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AdminHeader userId={user.id} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
