import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await logAudit({ action: "sign_out" });
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
