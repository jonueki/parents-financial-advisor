import { NextResponse, type NextRequest } from "next/server";
import { logAudit, type AuditAction } from "@/lib/audit";

// Receives Supabase Auth events. We currently log sign-in inline from
// /auth/callback (guaranteed to fire on a successful magic-link exchange),
// so this endpoint is a hook point for events the SDK can't capture
// (e.g. password reset, user deletion) once we wire those up.
//
// Verification: Supabase Auth Hooks sign the body with a shared secret
// and include it in the Authorization header. We compare against
// SUPABASE_WEBHOOK_SECRET via a constant-time check.

type AuthWebhookPayload = {
  type: string;
  user?: { id?: string | null; email?: string | null };
  metadata?: Record<string, unknown>;
};

const EVENT_TO_AUDIT: Record<string, AuditAction> = {
  "auth.user.signed_out": "sign_out",
};

export async function POST(request: NextRequest) {
  const expected = process.env.SUPABASE_WEBHOOK_SECRET;
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!expected || !presented || !timingSafeEqual(expected, presented)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const payload = (await request.json()) as AuthWebhookPayload;
  const action = EVENT_TO_AUDIT[payload.type];

  if (!action) {
    return NextResponse.json({ ok: true, ignored: payload.type });
  }

  await logAudit({
    action,
    metadata: payload.metadata ?? null,
    actor: {
      profileId: payload.user?.id ?? null,
      email: payload.user?.email ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
