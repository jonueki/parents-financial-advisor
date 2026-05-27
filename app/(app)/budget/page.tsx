import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BudgetWizard, { type ActualsMap, type Category } from "./budget-wizard";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

  if (!membership?.household_id) {
    return (
      <section>
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="mt-4 text-base text-neutral-600">
          You&rsquo;re not a member of any household yet. Ask your household owner
          to send you an invite.
        </p>
      </section>
    );
  }

  const householdId = membership.household_id;

  // Budget categories for this household
  const { data: categoriesData } = await supabase
    .from("budget_categories")
    .select("id, name, monthly_budget_cents")
    .eq("household_id", householdId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Category[]>();

  const categories = categoriesData ?? [];

  // Actuals from the past ~13 months for pre-filling wizard inputs.
  // We filter by year >= last year to cover a 12-month back window without
  // needing a compound (year, month) comparison in PostgREST.
  const startYear = new Date().getFullYear() - 1;
  const { data: actualsData } = await supabase
    .from("category_actuals")
    .select("category_id, year, month, amount_cents")
    .eq("household_id", householdId)
    .gte("year", startYear);

  const actuals = actualsData ?? [];

  const actualsMap: ActualsMap = {};
  for (const a of actuals) {
    const key = `${a.year}-${a.month}`;
    if (!actualsMap[key]) actualsMap[key] = {};
    actualsMap[key][a.category_id] = a.amount_cents;
  }

  // Last month (the one the banner refers to)
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthYear = lastMonthDate.getFullYear();
  const lastMonthMonth = lastMonthDate.getMonth() + 1;
  const lastMonthKey = `${lastMonthYear}-${lastMonthMonth}`;
  const lastMonthHasData = lastMonthKey in actualsMap;

  // Default wizard month: walk back from last month to find the first
  // unrecorded month, up to 12 months.
  let defaultMonth = { year: lastMonthYear, month: lastMonthMonth };
  if (lastMonthHasData) {
    for (let i = 2; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!(k in actualsMap)) {
        defaultMonth = { year: d.getFullYear(), month: d.getMonth() + 1 };
        break;
      }
    }
  }

  const bannerMonthLabel =
    `${MONTH_NAMES[lastMonthMonth - 1]} ${lastMonthYear}`;

  // Banner only shows when there ARE categories but no data for last month.
  const showBanner = categories.length > 0 && !lastMonthHasData;
  const hasAnyActuals = actuals.length > 0;

  if (categories.length === 0) {
    return (
      <section>
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="mt-4 text-base text-neutral-600">
          No spending categories set up yet.{" "}
          <Link href="/settings" className="text-blue-700 underline">
            Add them in Settings →
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold">Budget</h1>
      <BudgetWizard
        householdId={householdId}
        categories={categories}
        actualsMap={actualsMap}
        defaultMonth={defaultMonth}
        showBanner={showBanner}
        bannerMonthLabel={bannerMonthLabel}
        hasAnyActuals={hasAnyActuals}
        lastMonth={{ year: lastMonthYear, month: lastMonthMonth }}
      />
    </section>
  );
}
