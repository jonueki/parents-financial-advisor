import { redeemInvite } from "./actions";

type SearchParams = Promise<{ token?: string }>;

export default async function JoinPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token } = await searchParams;
  const result = await redeemInvite(token ?? "");

  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-3xl font-semibold">Join a household</h1>
      <p
        className={`mt-4 text-base ${
          result.ok ? "text-green-700" : "text-red-700"
        }`}
      >
        {result.message}
      </p>
    </section>
  );
}
