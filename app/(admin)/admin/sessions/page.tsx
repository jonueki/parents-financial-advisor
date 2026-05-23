import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminOrRedirect } from "@/lib/require-admin";
import { revokeUserSessions } from "../actions";

// TODO: paginate when user count grows beyond perPage. Phase 1 is fine
// for ~10 households / ~30 users.
export default async function SessionsTab() {
  await requireAdminOrRedirect();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });

  if (error) {
    return <p className="text-red-700">Error: {error.message}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        {data.users.length} user{data.users.length === 1 ? "" : "s"}. Revoking
        signs them out everywhere immediately.
      </p>
      <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
        {data.users.map((u) => (
          <li
            key={u.id}
            className="flex items-center justify-between py-3"
          >
            <div>
              <p className="text-base font-medium">{u.email}</p>
              <p className="text-sm text-neutral-500">
                Last sign-in{" "}
                {u.last_sign_in_at
                  ? new Date(u.last_sign_in_at).toLocaleString()
                  : "never"}
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await revokeUserSessions(u.id);
              }}
            >
              <button
                type="submit"
                className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
              >
                Revoke sessions
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
