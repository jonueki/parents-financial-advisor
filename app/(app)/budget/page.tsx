import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BudgetWizardTrigger from "./budget-wizard";
import type { Category, ExistingActual } from "./budget-wizard";

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

function mostRecentPastMonth(): { year: number; month: number } {
  const now = new Date();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return { year, month };
}

function mostRecentUnrecordedMonth(
  actuals: { year: number; month: number }[],
): { year: number; month: number } {
  const now = new Date();
  for (let i = 1; i <= 12; i++) {
    let month = now.getMonth() + 1 - i;
    let year = now.getFullYear();
    if (month <= 0) {
      month += 12;
      year -= 1;
    }
    const hasActuals = actuals.some((a) => a.year === year && a.month === month);
    if (!hasActuals) return { year, month };
  }
  return mostRecentPastMonth();
}

export default async function BudgetPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <section>
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="mt-4 text-base text-neutral-600">
          You&apos;re not part of a household yet. Ask your household owner to send
          you an invite link.
        </p>
      </section>
    );
  }

  const householdId = membership.household_id;

  const { data: categoriesRaw } = await supabase
    .from("budget_categories")
    .select("id, name, monthly_budget_cents")
    .eq("household_id", householdId)
    .order("sort_order")
    .order("created_at");

  const categories: Category[] = categoriesRaw ?? [];

  const { data: actualsRaw } = await supabase
    .from("category_actuals")
    .select("category_id, year, month, amount_cents")
    .eq("household_id", householdId)
    .gte("year", new Date().getFullYear() - 1);

  const allActuals: ExistingActual[] = actualsRaw ?? [];

  const { year: lastYear, month: lastMonth } = mostRecentPastMonth();
  const lastMonthActuals = allActuals.filter(
    (a) => a.year === lastYear && a.month === lastMonth,
  );
  const lastMonthName = MONTH_NAMES[lastMonth - 1];

  const hasNoCategories = categories.length === 0;
  const hasNoActualsAtAll = allActuals.length === 0;
  const lastMonthMissing = !hasNoCategories && lastMonthActuals.length === 0;

  const defaultWizardMonth = mostRecentUnrecordedMonth(allActuals);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Budget</h1>

      {/* Banner: last month has no actuals (and categories exist) */}
      {lastMonthMissing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="text-base font-medium text-blue-900">
            You haven&apos;t recorded {lastMonthName} {lastYear} yet.
          </p>
          <BudgetWizardTrigger
            householdId={householdId}
            categories={categories}
            defaultYear={defaultWizardMonth.year}
            defaultMonth={defaultWizardMonth.month}
            allActuals={allActuals}
          />
        </div>
      )}

      {/* No-categories empty state */}
      {hasNoCategories && (
        <p className="rounded-xl border border-neutral-200 px-5 py-4 text-base text-neutral-600">
          No spending categories set up yet.{" "}
          <Link href="/settings" className="text-blue-700 underline">
            Add them in Settings →
          </Link>
        </p>
      )}

      {/* No-actuals-at-all empty state (categories exist but nothing recorded yet) */}
      {!hasNoCategories && hasNoActualsAtAll && (
        <p className="text-base text-neutral-500">
          No spending recorded yet. Tap &ldquo;Add now&rdquo; above to get started.
        </p>
      )}

      {/* Actuals table for last month (if data exists) */}
      {!hasNoCategories && lastMonthActuals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold">
            {lastMonthName} {lastYear}
          </h2>
          <table className="mt-3 w-full text-base">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-sm text-neutral-500">
                <th className="pb-2 font-normal">Category</th>
                <th className="pb-2 text-right font-normal">Actual</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const actual = lastMonthActuals.find((a) => a.category_id === cat.id);
                return (
                  <tr key={cat.id} className="border-b border-neutral-100">
                    <td className="py-3">{cat.name}</td>
                    <td className="py-3 text-right">
                      {actual !== undefined ? (
                        `$${Math.round(actual.amount_cents / 100).toLocaleString()}`
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
