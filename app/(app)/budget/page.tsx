import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BudgetWizard, { type Category } from "./budget-wizard";

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

function previousMonth(): { year: number; month: number } {
  const now = new Date();
  const m = now.getMonth(); // 0-indexed; equals 1-indexed previous month
  if (m === 0) {
    return { year: now.getFullYear() - 1, month: 12 };
  }
  return { year: now.getFullYear(), month: m };
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
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="text-base text-neutral-600">
          You are not a member of any household yet. Ask your household owner to
          invite you.
        </p>
      </section>
    );
  }

  const householdId = membership.household_id as string;
  const { year: defaultYear, month: defaultMonth } = previousMonth();

  const [categoriesResult, lastMonthResult, anyActualsResult] =
    await Promise.all([
      supabase
        .from("budget_categories")
        .select("id, name, monthly_budget_cents")
        .eq("household_id", householdId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("category_actuals")
        .select("id")
        .eq("household_id", householdId)
        .eq("year", defaultYear)
        .eq("month", defaultMonth)
        .limit(1),
      supabase
        .from("category_actuals")
        .select("id")
        .eq("household_id", householdId)
        .limit(1),
    ]);

  const categories = (categoriesResult.data ?? []) as Category[];
  const hasCategories = categories.length > 0;
  const hasMissingLastMonth =
    hasCategories && (lastMonthResult.data?.length ?? 0) === 0;
  const hasAnyActuals = (anyActualsResult.data?.length ?? 0) > 0;
  const lastMonthName = `${MONTH_NAMES[defaultMonth - 1]} ${defaultYear}`;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Budget</h1>

      {!hasCategories ? (
        <div className="rounded-lg border border-neutral-200 p-6">
          <p className="text-base text-neutral-600">
            No spending categories set up yet.{" "}
            <a href="/settings" className="text-blue-700 underline">
              Add them in Settings →
            </a>
          </p>
        </div>
      ) : (
        <BudgetWizard
          householdId={householdId}
          categories={categories}
          defaultYear={defaultYear}
          defaultMonth={defaultMonth}
          hasMissingLastMonth={hasMissingLastMonth}
          lastMonthName={lastMonthName}
          hasAnyActuals={hasAnyActuals}
        />
      )}
    </section>
  );
}
