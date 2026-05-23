"use client";

import { useActionState } from "react";
import { sendMagicLink } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, null);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="text-base font-medium">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        className="h-14 rounded-lg border border-neutral-300 px-4 text-lg focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
        placeholder="you@example.com"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-lg bg-blue-700 text-lg font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-base ${state.ok ? "text-green-700" : "text-red-700"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
