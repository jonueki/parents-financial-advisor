"use client";

import { useActionState } from "react";
import { redeemInvite } from "./actions";

export function JoinForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; message: string } | null, formData: FormData) => {
      const result = await redeemInvite(formData);
      // redeemInvite redirects on success and only returns on failure.
      if (result.ok) return { ok: true, message: "" };
      return { ok: false, message: result.message };
    },
    null,
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-lg bg-blue-700 text-lg font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Joining…" : "Accept invite"}
      </button>
      {state && !state.ok && (
        <p role="alert" className="text-base text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
