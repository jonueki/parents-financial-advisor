import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BudgetClient } from "./budget-client";

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

function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export default async function BudgetPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already redirects unauthenticated users; this is belt-and-suspenders.
  if (!user) return null;

  // Resolve the user's household (take first membership; users belong to one household).
  const { data: memberships } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .limit(1);

  const householdId = memberships?.[0]?.household_id as string | undefined;

  if (!householdId) {
    return (
      <section>
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="mt-4 text-base text-neutral-600">
          You&apos;re not part of a household yet. Ask your administrator to
          send you an invite.
        </p>
      </section>
    );
  }

  // Load active categories (ordered by sort_order then name).
  const { data: categories, error: catError } = await supabase
    .from("budget_categories")
    .select("id, name, monthly_budget_cents")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (catError) {
    return (
      <section>
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="mt-4 text-base text-red-600">
          Could not load categories: {catError.message}
        </p>
      </section>
    );
  }

  // Load actuals for the past two years (small dataset; avoids complex range filter).
  const twoYearsAgo = new Date().getFullYear() - 2;
  const { data: actuals, error: actualsError } = await supabase
    .from("category_actuals")
    .select("category_id, year, month, amount_cents")
    .eq("household_id", householdId)
    .gte("year", twoYearsAgo)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (actualsError) {
    return (
      <section>
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="mt-4 text-base text-red-600">
          Could not load spending data: {actualsError.message}
        </p>
      </section>
    );
  }

  // Determine whether to show the "you haven't recorded last month" banner.
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthYear = lastMonthDate.getFullYear();
  const lastMonthMonth = lastMonthDate.getMonth() + 1;
  const bannerMonthLabel = formatMonthYear(lastMonthYear, lastMonthMonth);

  const hasLastMonthActuals = (actuals ?? []).some(
    (a) => a.year === lastMonthYear && a.month === lastMonthMonth,
  );
  const showBanner =
    (categories ?? []).length > 0 && !hasLastMonthActuals;

  const hasAnyActuals = (actuals ?? []).length > 0;

  return (
    <section>
      <h1 className="mb-6 text-3xl font-semibold">Budget</h1>
      <BudgetClient
        householdId={householdId}
        categories={categories ?? []}
        actuals={actuals ?? []}
        showBanner={showBanner}
        bannerMonthLabel={bannerMonthLabel}
        hasAnyActuals={hasAnyActuals}
      />
    </section>
  );
}
