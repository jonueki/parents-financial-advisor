import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { safeNext } from "@/lib/safe-next";

// Maps internal errors to a fixed set of codes so we never reflect raw
// error.message into the URL.
const ERROR_CODES = new Set([
  "missing_code",
  "invalid_token",
  "expired_token",
  "unknown",
]);

function errorRedirect(origin: string, code: string) {
  const safe = ERROR_CODES.has(code) ? code : "unknown";
  return NextResponse.redirect(`${origin}/login?error=${safe}`);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return errorRedirect(origin, "missing_code");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const mapped =
      /expired/i.test(error.message) ? "expired_token" : "invalid_token";
    return errorRedirect(origin, mapped);
  }

  await logAudit({ action: "sign_in" });

  return NextResponse.redirect(`${origin}${next}`);
}
