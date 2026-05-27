import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/budget");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Family Budget</h1>
          <p className="text-muted-foreground">
            Enter your email to receive a sign-in link.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
