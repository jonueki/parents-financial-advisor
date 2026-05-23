import { createSupabaseAdminClient } from "@/lib/supabase/server";

type AuditRow = {
  id: string;
  created_at: string;
  action_type: string;
  actor_email: string | null;
  household_id: string | null;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
};

const PAGE_SIZE = 100;

export default async function AuditTab() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("audit_log")
    .select(
      "id, created_at, action_type, actor_email, household_id, target_table, target_id, metadata, ip_address",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE)
    .returns<AuditRow[]>();

  if (error) {
    return <p className="text-red-700">Error: {error.message}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-sm text-neutral-600">
        Showing the {data?.length ?? 0} most recent events.
      </p>
      <table className="min-w-full text-sm">
        <thead className="border-b border-neutral-300 text-left text-neutral-600">
          <tr>
            <th className="py-2 pr-4">When</th>
            <th className="py-2 pr-4">Actor</th>
            <th className="py-2 pr-4">Action</th>
            <th className="py-2 pr-4">Target</th>
            <th className="py-2 pr-4">IP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data?.map((row) => (
            <tr key={row.id}>
              <td className="py-2 pr-4">
                {new Date(row.created_at).toLocaleString()}
              </td>
              <td className="py-2 pr-4">{row.actor_email ?? "—"}</td>
              <td className="py-2 pr-4 font-mono">{row.action_type}</td>
              <td className="py-2 pr-4 font-mono">
                {row.target_table
                  ? `${row.target_table}:${row.target_id ?? "—"}`
                  : "—"}
              </td>
              <td className="py-2 pr-4 font-mono">{row.ip_address ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
