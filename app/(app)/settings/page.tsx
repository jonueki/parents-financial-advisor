import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-base text-neutral-600">
          Signed in as {user?.email}.
        </p>
      </header>

      <form action="/api/auth/sign-out" method="post">
        <button
          type="submit"
          className="h-14 rounded-lg border border-neutral-300 px-6 text-base font-semibold hover:bg-neutral-100"
        >
          Sign out
        </button>
      </form>
    </section>
  );
}
