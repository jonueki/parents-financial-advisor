"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function redeemInvite(token: string) {
  if (!token) {
    return { ok: false as const, message: "Missing invite token." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join?token=${token}`)}`);
  }

  const admin = createSupabaseAdminClient();
  const tokenHash = hashToken(token);

  const { data: invite, error: inviteErr } = await admin
    .from("household_invites")
    .select("id, household_id, expires_at, consumed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (inviteErr || !invite) {
    return { ok: false as const, message: "This invite link is not valid." };
  }
  if (invite.consumed_at) {
    return { ok: false as const, message: "This invite has already been used." };
  }
  if (new Date(invite.expires_at) < new Date()) {
    return { ok: false as const, message: "This invite has expired." };
  }

  const { error: insertErr } = await admin
    .from("household_members")
    .insert({
      household_id: invite.household_id,
      profile_id: user.id,
      role: "owner",
    });
  if (insertErr && insertErr.code !== "23505") {
    return { ok: false as const, message: insertErr.message };
  }

  await admin
    .from("household_invites")
    .update({ consumed_at: new Date().toISOString(), consumed_by: user.id })
    .eq("id", invite.id);

  await logAudit({
    action: "invite_redeemed",
    householdId: invite.household_id,
    targetTable: "household_invites",
    targetId: invite.id,
  });

  redirect("/");
}
