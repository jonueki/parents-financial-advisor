import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TABS = [
  { href: "/budget", label: "Budget" },
  { href: "/goals", label: "Goals" },
  { href: "/net-worth", label: "Net worth" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Proxy already handles unauthenticated redirects with ?next=; this
    // branch is belt-and-suspenders for when middleware is bypassed (e.g.
    // a request that didn't match the proxy matcher).
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex-1 px-6 py-8 pb-28">{children}</div>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white"
      >
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((tab) => (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className="flex h-16 items-center justify-center text-base font-medium text-neutral-700 hover:text-blue-700"
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
