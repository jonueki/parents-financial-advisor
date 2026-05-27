import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BudgetCategory, CategoryActual } from "./types";
import { MonthWizard } from "./month-wizard";
import { saveCategoryActuals } from "./actions";

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

function prevCalendarMonth(now: Date): { year: number; month: number } {
  // getMonth() is 0-indexed, so getMonth() without +1 gives last month 1-indexed.
  return now.getMonth() === 0
    ? { year: now.getFullYear() - 1, month: 12 }
    : { year: now.getFullYear(), month: now.getMonth() };
}

export default async function BudgetPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberRow } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!memberRow) {
    return (
      <section>
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="mt-6 text-base text-neutral-600">
          You are not part of any household yet.
        </p>
      </section>
    );
  }

  const householdId = memberRow.household_id;

  const [{ data: categories }, { data: actuals }] = await Promise.all([
    supabase
      .from("budget_categories")
      .select("id, name, monthly_budget_cents")
      .eq("household_id", householdId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("category_actuals")
      .select("category_id, year, month, amount_cents")
      .eq("household_id", householdId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(500),
  ]);

  const safeCategories: BudgetCategory[] = categories ?? [];
  const safeActuals: CategoryActual[] = actuals ?? [];

  const now = new Date();
  const lastMonth = prevCalendarMonth(now);

  const hasLastMonthActuals = safeActuals.some(
    (a) => a.year === lastMonth.year && a.month === lastMonth.month,
  );
  const hasCategories = safeCategories.length > 0;
  const hasAnyActuals = safeActuals.length > 0;
  const showBanner = hasCategories && !hasLastMonthActuals;

  const bannerMonthLabel = `${MONTH_NAMES[lastMonth.month - 1]} ${lastMonth.year}`;

  return (
    <section>
      <h1 className="text-3xl font-semibold">Budget</h1>

      {!hasCategories ? (
        <p className="mt-6 text-base text-neutral-600">
          No spending categories set up yet.{" "}
          <a href="/settings" className="text-blue-700 underline">
            Add them in Settings →
          </a>
        </p>
      ) : (
        <>
          <MonthWizard
            categories={safeCategories}
            actuals={safeActuals}
            defaultMonth={lastMonth}
            showBanner={showBanner}
            bannerMonthLabel={bannerMonthLabel}
            saveAction={saveCategoryActuals}
          />

          {!hasAnyActuals && (
            <p className="mt-6 text-base text-neutral-600">
              No spending recorded yet. Tap &ldquo;Add now&rdquo; to get
              started.
            </p>
          )}
        </>
      )}
    </section>
  );
}
