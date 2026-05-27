import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { event, user } = body;

  if (!user?.id) {
    return NextResponse.json({ error: "no user" }, { status: 400 });
  }

  const actionType =
    event === "INSERT" ? "sign_in" : event === "LOGOUT" ? "sign_out" : event;

  const supabase = await createServiceClient();
  await supabase.from("audit_log").insert({
    actor_profile_id: user.id,
    actor_email: user.email ?? null,
    action_type: actionType,
    metadata: { provider: user.app_metadata?.provider },
  });

  return NextResponse.json({ ok: true });
}
