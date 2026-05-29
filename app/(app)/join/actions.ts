"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// Invite tokens are stored hashed (SHA-256). For this to be brute-resistant
// the *raw* token must be ≥128 bits of CSPRNG (use crypto.randomBytes(32)
// when the create-invite UI lands). The Postgres redeem_invite function is
// the source of truth for race-safety, email binding, and role assignment.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type RedeemResult =
  | { ok: true }
  | { ok: false; message: string };

export async function redeemInvite(formData: FormData): Promise<RedeemResult> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    return { ok: false, message: "Missing invite token." };
  }

  // The user-session client (anon key + JWT cookie) calls the redeem_invite
  // RPC. The function is SECURITY DEFINER but reads auth.uid() from the JWT
  // GUC, so we cannot use the service-role client here — auth.uid() would
  // be null and the function would reject.
  const { supabase, user } = await getServerUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join?token=${token}`)}`);
  }

  const tokenHash = hashToken(token);

  const { data, error } = await supabase
    .rpc("redeem_invite", { p_token_hash: tokenHash })
    .maybeSingle<{ household_id: string; role: string }>();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data) {
    return {
      ok: false,
      message:
        "This invite is not valid, has expired, has already been used, or was issued to a different email.",
    };
  }

  await logAudit({
    action: "invite_redeemed",
    householdId: data.household_id,
    targetTable: "household_invites",
    metadata: { role: data.role },
  });

  redirect("/");
}
