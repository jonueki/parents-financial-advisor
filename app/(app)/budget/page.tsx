import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EntryWizard } from "./entry-wizard";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The most-recent past month (never the current month, which is still in progress).
function lastMonth(): { year: number; month: number } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default async function BudgetPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Resolve the user's household (first membership found).
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
          You&rsquo;re not a member of any household yet. Ask your household
          owner to send you an invite link.
        </p>
      </section>
    );
  }

  const householdId = membership.household_id;

  // Fetch active categories for this household.
  const { data: categories } = await supabase
    .from("budget_categories")
    .select("id, name, monthly_budget_cents")
    .eq("household_id", householdId)
    .order("display_order", { ascending: true });

  const { year: lastYear, month: lastMo } = lastMonth();
  const lastMonthLabel = `${MONTH_NAMES[lastMo - 1]} ${lastYear}`;

  // Check if last month has any actuals.
  const { count: lastMonthCount } = await supabase
    .from("category_actuals")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("year", lastYear)
    .eq("month", lastMo);

  const hasLastMonthActuals = (lastMonthCount ?? 0) > 0;

  // Check if any actuals exist at all (for empty-state copy).
  const { count: totalCount } = await supabase
    .from("category_actuals")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId);

  const hasAnyActuals = (totalCount ?? 0) > 0;

  // Existing actuals for last month (for wizard pre-population).
  const { data: existingActuals } = await supabase
    .from("category_actuals")
    .select("category_id, amount_cents")
    .eq("household_id", householdId)
    .eq("year", lastYear)
    .eq("month", lastMo);

  const noCategories = !categories || categories.length === 0;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Budget</h1>

      {/* Banner: only when categories exist and last month is unrecorded */}
      {!noCategories && !hasLastMonthActuals && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base font-medium text-blue-900">
            You haven&rsquo;t recorded {lastMonthLabel} yet.
          </p>
          <EntryWizard
            householdId={householdId}
            categories={categories ?? []}
            defaultYear={lastYear}
            defaultMonth={lastMo}
            existingActuals={existingActuals ?? []}
          />
        </div>
      )}

      {/* No categories empty state */}
      {noCategories && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-8 text-center">
          <p className="text-base text-neutral-700">
            No spending categories set up yet.{" "}
            <Link href="/settings" className="font-medium text-blue-700 underline">
              Add them in Settings →
            </Link>
          </p>
        </div>
      )}

      {/* No actuals empty state (categories exist but nothing recorded) */}
      {!noCategories && !hasAnyActuals && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-8 text-center">
          <p className="text-base text-neutral-700">
            No spending recorded yet. Tap &ldquo;Add {lastMonthLabel}&rdquo; to get started.
          </p>
        </div>
      )}

      {/* Actuals summary (placeholder for the future reporting view) */}
      {!noCategories && hasAnyActuals && (
        <p className="text-base text-neutral-500">
          Spending summary coming soon.
        </p>
      )}
    </section>
  );
}
