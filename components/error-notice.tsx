// Inline error display for admin tabs when a data fetch fails. Kept generic so
// every tab surfaces failures the same way.
export function ErrorNotice({ message }: { message: string }) {
  return <p className="text-red-700">Error: {message}</p>;
}
