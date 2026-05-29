import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerUser = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: User | null;
};

// Convenience wrapper around the two calls almost every page, server action,
// and route makes: build the request-scoped server client and resolve the
// current user from the JWT cookie. Returning both lets callers reuse the one
// client for follow-up queries instead of constructing a second.
export async function getServerUser(): Promise<ServerUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
