"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) throw new Error("Not authorized");
}

export async function revokeUserSessions(targetUserId: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.signOut(targetUserId, "global");
  if (error) throw error;

  await logAudit({
    action: "session_revoked_by_admin",
    targetTable: "auth.users",
    targetId: targetUserId,
  });

  revalidatePath("/admin/sessions");
}

export async function revokeInvite(inviteId: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data: invite } = await admin
    .from("household_invites")
    .select("household_id")
    .eq("id", inviteId)
    .maybeSingle();

  const { error } = await admin
    .from("household_invites")
    .delete()
    .eq("id", inviteId);
  if (error) throw error;

  await logAudit({
    action: "invite_revoked",
    householdId: invite?.household_id ?? null,
    targetTable: "household_invites",
    targetId: inviteId,
  });

  revalidatePath("/admin/invites");
}

export async function removeMember(householdId: string, profileId: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  // Refuse to remove the last owner — would leave the household orphaned
  // (no member can see it via RLS; only service-role can reach it).
  const { data: target } = await admin
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (target?.role === "owner") {
    const { count } = await admin
      .from("household_members")
      .select("*", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      throw new Error(
        "Cannot remove the last owner. Promote another member to owner first or delete the household.",
      );
    }
  }

  const { error } = await admin
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("profile_id", profileId);
  if (error) throw error;

  await logAudit({
    action: "member_removed",
    householdId,
    targetTable: "household_members",
    targetId: profileId,
  });

  revalidatePath("/admin/households");
}
