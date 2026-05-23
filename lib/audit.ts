import { headers } from "next/headers";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type AuditAction =
  | "sign_in"
  | "sign_out"
  | "session_revoked_by_admin"
  | "invite_created"
  | "invite_revoked"
  | "invite_redeemed"
  | "household_created"
  | "household_updated"
  | "member_removed"
  | "account_created"
  | "account_updated"
  | "account_deleted"
  | "snapshot_recorded"
  | "category_actual_recorded"
  | "income_actual_recorded"
  | "goal_created"
  | "goal_updated"
  | "goal_deleted";

type LogAuditArgs = {
  action: AuditAction;
  householdId?: string | null;
  targetTable?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  // Override the caller — used by the webhook handler where there is no JWT.
  actor?: { profileId: string | null; email: string | null };
};

export async function logAudit(args: LogAuditArgs) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  let actorProfileId = args.actor?.profileId ?? null;
  let actorEmail = args.actor?.email ?? null;

  if (!args.actor) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    actorProfileId = user?.id ?? null;
    actorEmail = user?.email ?? null;
  }

  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent");

  await admin.from("audit_log").insert({
    actor_profile_id: actorProfileId,
    actor_email: actorEmail,
    household_id: args.householdId ?? null,
    action_type: args.action,
    target_table: args.targetTable ?? null,
    target_id: args.targetId ?? null,
    metadata: args.metadata ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}
