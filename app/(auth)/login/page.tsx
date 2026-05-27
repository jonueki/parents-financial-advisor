import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold">Sign in</h1>
      <p className="mt-2 text-base text-neutral-600">
        We&apos;ll email you a one-time link. No password to remember.
      </p>
      <LoginForm next={next ?? "/"} />
    </main>
  );
}
