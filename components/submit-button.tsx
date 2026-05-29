// Shared submit button for the inline server-action forms in the admin tabs.
// `danger` is for destructive actions (revoke, remove); `neutral` for the rest.
const VARIANTS = {
  neutral: "border-neutral-300 hover:bg-neutral-100",
  danger: "border-red-300 text-red-700 hover:bg-red-50",
} as const;

export function SubmitButton({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <button
      type="submit"
      className={`rounded border px-3 py-2 text-sm ${VARIANTS[variant]}`}
    >
      {children}
    </button>
  );
}
