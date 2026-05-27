import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminOrRedirect } from "@/lib/require-admin";
import { revokeInvite } from "../actions";

type InviteRow = {
  id: string;
  email: string | null;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  households: { name: string } | null;
};

export default async function InvitesTab() {
  await requireAdminOrRedirect();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("household_invites")
    .select("id, email, created_at, expires_at, consumed_at, households(name)")
    .order("created_at", { ascending: false })
    .returns<InviteRow[]>();

  if (error) {
    return <p className="text-red-700">Error: {error.message}</p>;
  }

  return (
    <div>
      {data?.length === 0 && (
        <p className="text-base text-neutral-600">No invites.</p>
      )}
      <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
        {data?.map((inv) => {
          const status = inv.consumed_at
            ? "Consumed"
            : new Date(inv.expires_at) < new Date()
              ? "Expired"
              : "Active";
          return (
            <li
              key={inv.id}
              className="flex items-center justify-between py-3"
            >
              <div>
                <p className="text-base font-medium">
                  {inv.households?.name ?? "(unknown)"} · {inv.email ?? "(no email)"}
                </p>
                <p className="text-sm text-neutral-500">
                  {status} · created{" "}
                  {new Date(inv.created_at).toLocaleDateString()} · expires{" "}
                  {new Date(inv.expires_at).toLocaleDateString()}
                </p>
              </div>
              {!inv.consumed_at && (
                <form
                  action={async () => {
                    "use server";
                    await revokeInvite(inv.id);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    Revoke
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
