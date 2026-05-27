import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EntryWizard } from "./entry-wizard";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function mostRecentPastMonth(): { year: number; month: number } {
  const d = new Date();
  const month = d.getMonth(); // 0-indexed; .getMonth() on current date gives us prior month's 1-indexed value
  if (month === 0) {
    return { year: d.getFullYear() - 1, month: 12 };
  }
  return { year: d.getFullYear(), month: month };
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
    .single();

  if (!membership) {
    return (
      <section>
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="mt-4 text-base text-neutral-600">
          You&apos;re not a member of any household yet. Ask your household owner
          for an invite link.
        </p>
      </section>
    );
  }

  const householdId = membership.household_id;

  const { data: categories } = await supabase
    .from("budget_categories")
    .select("id, name, monthly_budget_cents")
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const safeCategories = categories ?? [];

  const target = mostRecentPastMonth();

  const { data: targetActuals } = await supabase
    .from("category_actuals")
    .select("category_id, amount_cents")
    .eq("household_id", householdId)
    .eq("year", target.year)
    .eq("month", target.month);

  const existingActuals = targetActuals ?? [];
  const hasActualsForTarget = existingActuals.length > 0;

  const { count: totalActualsCount } = await supabase
    .from("category_actuals")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId);

  const hasAnyActuals = (totalActualsCount ?? 0) > 0;
  const targetMonthLabel = `${MONTH_NAMES[target.month - 1]} ${target.year}`;
  const showBanner = safeCategories.length > 0 && !hasActualsForTarget;

  return (
    <section className="space-y-8">
      <h1 className="text-3xl font-semibold">Budget</h1>

      {showBanner && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base font-medium text-blue-900">
            You haven&apos;t recorded {targetMonthLabel} yet.
          </p>
          <EntryWizard
            householdId={householdId}
            categories={safeCategories}
            defaultYear={target.year}
            defaultMonth={target.month}
            existingActuals={existingActuals}
          />
        </div>
      )}

      {safeCategories.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-8 text-center">
          <p className="text-base font-medium text-neutral-700">
            No spending categories set up yet.{" "}
            <Link
              href="/settings"
              className="text-blue-700 underline hover:text-blue-900"
            >
              Add them in Settings →
            </Link>
          </p>
        </div>
      )}

      {safeCategories.length > 0 && !hasAnyActuals && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-8 text-center">
          <p className="text-base font-medium text-neutral-700">
            No spending recorded yet. Tap &ldquo;Add {targetMonthLabel}&rdquo; to get
            started.
          </p>
        </div>
      )}

      {hasAnyActuals && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{targetMonthLabel}</h2>
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="pb-2 text-left font-semibold text-neutral-700">Category</th>
                <th className="pb-2 text-right font-semibold text-neutral-700">Spent</th>
                <th className="pb-2 text-right font-semibold text-neutral-700">Budget</th>
              </tr>
            </thead>
            <tbody>
              {safeCategories.map((cat) => {
                const actual = existingActuals.find((a) => a.category_id === cat.id);
                const spent = actual ? actual.amount_cents : null;
                const budget = cat.monthly_budget_cents;
                return (
                  <tr key={cat.id} className="border-b border-neutral-100">
                    <td className="py-3 text-neutral-800">{cat.name}</td>
                    <td className="py-3 text-right text-neutral-800">
                      {spent !== null
                        ? "$" + Math.round(spent / 100).toLocaleString("en-US")
                        : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="py-3 text-right text-neutral-500">
                      {budget !== null
                        ? "$" + Math.round(budget / 100).toLocaleString("en-US")
                        : <span className="text-neutral-400">—</span>}
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
