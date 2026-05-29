// Money helpers. All amounts are stored as positive integer cents; the sign is
// implied by the table a row lives in. These convert to/from the whole-dollar
// strings the UI shows (the app intentionally hides cents from older users).

// $1,000,000 — a generous outer ceiling used as a server-side sanity bound on
// any single manually-entered amount.
export const MAX_AMOUNT_CENTS = 100_000_000;

// Whole-dollar entry cap used by the wizard to flag obviously-mistyped numbers.
// Sits below MAX_AMOUNT_CENTS so the server bound is never the first to trip.
const MAX_DOLLARS = 999_999;

export function formatDollars(cents: number): string {
  return "$" + Math.round(cents / 100).toLocaleString("en-US");
}

// Strict whole-dollar parser: rejects "$123abc" and other trailing junk (which
// parseInt would silently truncate). Returns cents, or null when the input is
// not a clean non-negative whole-dollar amount within range.
export function parseDollarInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^[0-9]+$/.test(cleaned)) return null;
  const n = parseInt(cleaned, 10);
  if (!Number.isFinite(n) || n < 0 || n > MAX_DOLLARS) return null;
  return n * 100;
}

// Normalize a raw input string to "$1,234" display form, leaving invalid input
// untouched so the user can keep editing mid-entry.
export function formatInputDisplay(raw: string): string {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return "";
  if (!/^[0-9]+$/.test(cleaned)) return raw;
  const n = parseInt(cleaned, 10);
  if (!Number.isFinite(n)) return raw;
  return "$" + n.toLocaleString("en-US");
}
