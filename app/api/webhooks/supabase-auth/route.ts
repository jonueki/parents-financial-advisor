import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logAudit, type AuditAction } from "@/lib/audit";

// Receives Supabase Auth events. Sign-in is logged inline from
// /auth/callback (guaranteed to fire on a successful magic-link exchange);
// this endpoint exists for events the SDK can't capture (sign-out from
// other devices, user deletion, password reset, …) once we wire them up.
//
// Verification:
//   - Bearer-token compare against SUPABASE_WEBHOOK_SECRET (constant time).
//   - The caller-supplied actor identity is *not* trusted directly — we
//     re-fetch the user from auth.users via the service-role admin client
//     to confirm it exists, and only then use the canonical id/email from
//     the database as the audit actor.

type AuthWebhookPayload = {
  type: string;
  user?: { id?: string | null; email?: string | null };
  metadata?: Record<string, unknown>;
};

const EVENT_TO_AUDIT: Record<string, AuditAction> = {
  "auth.user.signed_out": "sign_out",
};

function bearerEquals(presented: string | null, expected: string): boolean {
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const presented = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "") ?? null;

  if (!bearerEquals(presented, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const payload = (await request.json()) as AuthWebhookPayload;
  const action = EVENT_TO_AUDIT[payload.type];
  if (!action) {
    return NextResponse.json({ ok: true, ignored: payload.type });
  }

  // Resolve the actor from the database — never trust caller-supplied
  // user.id / user.email as the audit actor.
  let canonicalId: string | null = null;
  let canonicalEmail: string | null = null;
  if (payload.user?.id) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(payload.user.id);
    if (error) {
      // Supabase auth-js returns `{ data: { user: null }, error: AuthError(status=404) }`
      // when the user doesn't exist — distinct from a transient failure (5xx,
      // network error). 404 means the user was deleted between event emission
      // and this handler; legitimate null actor.
      const isMissing = error.status === 404;
      if (!isMissing) {
        console.error("supabase-auth webhook: actor lookup failed", {
          userId: payload.user.id,
          status: error.status,
          message: error.message,
        });
        return NextResponse.json({ ok: false, retry: true }, { status: 500 });
      }
      // 404 → leave canonicalId/Email as null; fall through to audit write.
    } else if (data?.user) {
      canonicalId = data.user.id;
      canonicalEmail = data.user.email ?? null;
    }
  }

  await logAudit({
    action,
    metadata: payload.metadata ?? null,
    actor: { profileId: canonicalId, email: canonicalEmail },
  });

  return NextResponse.json({ ok: true });
}
