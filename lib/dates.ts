// Date / month-period helpers shared by the budgeting wizards. Months are
// 1-based (1 = January) everywhere a "month" number crosses a boundary, to
// match how the non-technical UI and the (year, month) actuals key talk.

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// Human label like "March 2026" for a 1-based month.
export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// The most-recent complete month — never the current, still-in-progress one.
// Returns a 1-based month.
export function lastMonth(): { year: number; month: number } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
