import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/budget");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-4 py-4">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
