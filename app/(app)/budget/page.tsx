import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BudgetWizard, type Actual, type Category } from "./wizard";

// Returns { year, month } for the most recent past calendar month.
function prevCalendarMonth(): { year: number; month: number; label: string } {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    label: d.toLocaleString("en-US", { month: "long", year: "numeric" }),
  };
}

export default async function BudgetPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // First household membership (v1 assumes one household per user).
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!membership) {
    return (
      <section>
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="mt-4 text-base text-neutral-600">
          You are not a member of a household yet. Ask the admin to send you an
          invite link.
        </p>
      </section>
    );
  }

  const householdId = membership.household_id;

  const [{ data: categories }, { data: actuals }] = await Promise.all([
    supabase
      .from("budget_categories")
      .select("id, name, monthly_budget_cents")
      .eq("household_id", householdId)
      .order("name")
      .returns<Category[]>(),
    supabase
      .from("category_actuals")
      .select("category_id, year, month, amount_cents")
      .eq("household_id", householdId)
      .returns<Actual[]>(),
  ]);

  const cats: Category[] = categories ?? [];
  const acts: Actual[] = actuals ?? [];
  const prev = prevCalendarMonth();
  const hasCategories = cats.length > 0;
  const hasAnyActuals = acts.length > 0;

  // Banner: show when there ARE categories but NO actuals for last month.
  const prevMonthRecorded = acts.some(
    (a) => a.year === prev.year && a.month === prev.month,
  );
  const showBanner = hasCategories && !prevMonthRecorded;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Budget</h1>

      {/* No categories → guide user to Settings */}
      {!hasCategories && (
        <div className="rounded-2xl border border-neutral-200 px-6 py-8 text-center">
          <p className="text-lg font-medium">No spending categories set up yet.</p>
          <p className="mt-2 text-base text-neutral-600">
            Add them in{" "}
            <Link href="/settings" className="text-blue-600 underline">
              Settings
            </Link>{" "}
            to get started.
          </p>
        </div>
      )}

      {/* Banner: unrecorded month */}
      {showBanner && (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg font-medium text-blue-900">
            You haven&rsquo;t recorded {prev.label} yet.
          </p>
          <BudgetWizard
            householdId={householdId}
            categories={cats}
            actuals={acts}
            defaultYear={prev.year}
            defaultMonth={prev.month}
          />
        </div>
      )}

      {/* Main content area */}
      {hasCategories && !hasAnyActuals && (
        <p className="text-base text-neutral-600">
          No spending recorded yet. Tap &ldquo;Add now&rdquo; above to get started.
        </p>
      )}

      {hasCategories && hasAnyActuals && (
        <p className="text-base text-neutral-500">
          Budget summary coming soon.
        </p>
      )}
    </section>
  );
}
