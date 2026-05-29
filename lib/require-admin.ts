import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getServerUser } from "@/lib/auth";

const ADMIN_LOGIN_REDIRECT = "/login?next=/admin/households";

// Single source of truth for "who is the current user, and are they an admin?"
// `is_admin` lives on the profiles row (not a household_members membership) and
// is only writable by the service-role client, so reading it here is safe.
export async function getAdminContext(): Promise<{
  user: User | null;
  isAdmin: boolean;
}> {
  const { supabase, user } = await getServerUser();
  if (!user) return { user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return { user, isAdmin: profile?.is_admin === true };
}

// For /admin/* pages: bounce unauthenticated users to login and non-admins to
// the app root. Defense-in-depth — the admin layout also gates, but a layout
// regression shouldn't silently expose admin data.
export async function requireAdminOrRedirect() {
  const { user, isAdmin } = await getAdminContext();
  if (!user) redirect(ADMIN_LOGIN_REDIRECT);
  if (!isAdmin) redirect("/");
}

// For admin server actions, which have no navigation context to redirect into:
// throw instead. The caller surface (a button in an already-rendered admin
// page) means a thrown error here is the right failure mode.
export async function assertAdmin() {
  const { user, isAdmin } = await getAdminContext();
  if (!user) throw new Error("Not signed in");
  if (!isAdmin) throw new Error("Not authorized");
}
