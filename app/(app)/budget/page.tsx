import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BudgetView } from "./budget-view";

export type Category = {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
};

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
    .maybeSingle();

  if (!membership) {
    return (
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="mt-4 text-neutral-600">
          You&rsquo;re not yet part of a household. Ask your family to send you
          an invite.
        </p>
      </section>
    );
  }

  const householdId = membership.household_id;

  // Most recent past month
  const now = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultYear = prevDate.getFullYear();
  const defaultMonth = prevDate.getMonth() + 1;

  const { data: categories } = await supabase
    .from("budget_categories")
    .select("id, name, monthly_budget_cents")
    .eq("household_id", householdId)
    .order("name")
    .returns<Category[]>();

  const hasCategories = (categories?.length ?? 0) > 0;

  // Check whether last month is already recorded (only matters if categories exist)
  let lastMonthRecorded = false;
  if (hasCategories) {
    const { data: sample } = await supabase
      .from("category_actuals")
      .select("id")
      .eq("household_id", householdId)
      .eq("year", defaultYear)
      .eq("month", defaultMonth)
      .limit(1);
    lastMonthRecorded = (sample?.length ?? 0) > 0;
  }

  const { data: anyActuals } = await supabase
    .from("category_actuals")
    .select("id")
    .eq("household_id", householdId)
    .limit(1);
  const hasAnyActuals = (anyActuals?.length ?? 0) > 0;

  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-semibold">Budget</h1>
      <BudgetView
        householdId={householdId}
        categories={categories ?? []}
        hasAnyActuals={hasAnyActuals}
        lastMonthRecorded={lastMonthRecorded}
        defaultYear={defaultYear}
        defaultMonth={defaultMonth}
      />
    </section>
  );
}
