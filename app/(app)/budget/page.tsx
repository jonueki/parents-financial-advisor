import { getBudgetPageData, getHouseholdId } from "./actions";
import BudgetBanner from "./budget-banner";
import Link from "next/link";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default async function BudgetPage() {
  const householdId = await getHouseholdId();

  if (!householdId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg text-muted-foreground">
          You are not part of a household yet.
        </p>
        <Link href="/settings" className="text-primary underline">
          Go to Settings to set up your household
        </Link>
      </div>
    );
  }

  const { categories, latestActualMonth, hasActualsForCurrentMonth } =
    await getBudgetPageData(householdId);

  const monthLabel = latestActualMonth
    ? `${MONTH_NAMES[latestActualMonth.month - 1]} ${latestActualMonth.year}`
    : null;

  const showBanner =
    categories.length > 0 && !hasActualsForCurrentMonth && monthLabel;

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-bold">Budget</h1>

      {categories.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center space-y-2">
          <p className="text-lg font-medium">No spending categories yet</p>
          <p className="text-muted-foreground">
            Add spending categories in{" "}
            <Link href="/settings" className="text-primary underline">
              Settings
            </Link>{" "}
            to start tracking your budget.
          </p>
        </div>
      ) : (
        <>
          {showBanner && (
            <BudgetBanner
              monthLabel={monthLabel}
              householdId={householdId}
              year={latestActualMonth!.year}
              month={latestActualMonth!.month}
              categories={categories}
            />
          )}

          {!hasActualsForCurrentMonth && categories.length > 0 && (
            <div className="rounded-lg border bg-muted/50 p-6 text-center">
              <p className="text-muted-foreground">
                No spending recorded yet. Tap &ldquo;Add {monthLabel}&rdquo; to
                get started.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
