import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminOrRedirect } from "@/lib/require-admin";
import { removeMember } from "../actions";

type MemberRow = {
  profile_id: string;
  role: string;
  joined_at: string;
  profiles: { email: string; display_name: string | null } | null;
};

type HouseholdRow = {
  id: string;
  name: string;
  created_at: string;
  household_members: MemberRow[];
};

export default async function HouseholdsTab() {
  await requireAdminOrRedirect();
  const admin = createSupabaseAdminClient();
  const { data: households, error } = await admin
    .from("households")
    .select(
      "id, name, created_at, household_members(profile_id, role, joined_at, profiles(email, display_name))",
    )
    .order("created_at", { ascending: false })
    .returns<HouseholdRow[]>();

  if (error) {
    return <p className="text-red-700">Error: {error.message}</p>;
  }

  return (
    <div className="space-y-8">
      {households?.length === 0 && (
        <p className="text-base text-neutral-600">No households yet.</p>
      )}
      {households?.map((h) => (
        <article key={h.id} className="rounded-lg border border-neutral-200 p-4">
          <header className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">{h.name}</h2>
            <span className="text-sm text-neutral-500">
              Created {new Date(h.created_at).toLocaleDateString()}
            </span>
          </header>
          <ul className="mt-4 space-y-2">
            {h.household_members?.map((m) => (
              <li
                key={m.profile_id}
                className="flex items-center justify-between border-t border-neutral-100 pt-2"
              >
                <div>
                  <p className="text-base font-medium">{m.profiles?.email}</p>
                  <p className="text-sm text-neutral-500">
                    {m.role} · joined{" "}
                    {new Date(m.joined_at).toLocaleDateString()}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await removeMember(h.id, m.profile_id);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
