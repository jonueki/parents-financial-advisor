import { JoinForm } from "./join-form";

type SearchParams = Promise<{ token?: string }>;

export default async function JoinPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <section className="mx-auto max-w-md">
        <h1 className="text-3xl font-semibold">Join a household</h1>
        <p className="mt-4 text-base text-red-700">Missing invite token.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-3xl font-semibold">Join a household</h1>
      <p className="mt-4 text-base text-neutral-700">
        You&apos;ve been invited to a household. Click the button to accept.
      </p>
      <JoinForm token={token} />
    </section>
  );
}
