"use server";

import { createClient } from "@/lib/supabase/server";

interface AuditParams {
  action: string;
  householdId?: string;
  targetTable?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(params: AuditParams) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("audit_log").insert({
    actor_profile_id: user?.id ?? null,
    actor_email: user?.email ?? null,
    household_id: params.householdId ?? null,
    action_type: params.action,
    target_table: params.targetTable ?? null,
    target_id: params.targetId ?? null,
    metadata: params.metadata ?? null,
  });
}
