import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TABS = [
  { href: "/admin/households", label: "Households" },
  { href: "/admin/sessions", label: "Sessions" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/households");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Not authorized</h1>
        <p className="mt-2 text-base text-neutral-600">
          You do not have access to the admin dashboard.
        </p>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <nav aria-label="Admin sections" className="mt-4 border-b border-neutral-200">
        <ul className="flex gap-6">
          {TABS.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className="inline-block py-3 text-base font-medium text-neutral-700 hover:text-blue-700"
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
