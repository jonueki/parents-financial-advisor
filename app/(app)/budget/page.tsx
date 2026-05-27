import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BudgetBanner } from "./budget-banner";

type Category = {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
};

type Actual = {
  category_id: string;
  year: number;
  month: number;
  amount_cents: number;
};

function getPreviousMonth(now: Date): { year: number; month: number } {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberRow } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .limit(1)
    .single();

  const householdId = memberRow?.household_id ?? null;

  let categories: Category[] = [];
  let actuals: Actual[] = [];
  const prevMonth = getPreviousMonth(new Date());

  if (householdId) {
    const { data: cats } = await supabase
      .from("budget_categories")
      .select("id, name, monthly_budget_cents")
      .eq("household_id", householdId)
      .eq("is_active", true)
      .order("name");
    categories = cats ?? [];

    const { data: acts } = await supabase
      .from("category_actuals")
      .select("category_id, year, month, amount_cents")
      .eq("household_id", householdId);
    actuals = acts ?? [];
  }

  // Check if prev month has any actuals
  const prevMonthActuals = actuals.filter(
    (a) => a.year === prevMonth.year && a.month === prevMonth.month
  );
  const hasPrevMonthData = prevMonthActuals.length > 0;
  const hasNoCategories = categories.length === 0;

  const monthName = new Date(prevMonth.year, prevMonth.month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Budget</h1>

      {householdId && !hasNoCategories && !hasPrevMonthData && (
        <BudgetBanner
          monthName={monthName}
          householdId={householdId}
          categories={categories}
          existingActuals={prevMonthActuals}
          prevMonth={prevMonth}
        />
      )}

      {!householdId && (
        <div className="rounded-lg border p-6 text-center space-y-2">
          <p className="text-lg font-medium">No household yet</p>
          <p className="text-muted-foreground">You&apos;re not a member of any household. Ask your family administrator to invite you.</p>
        </div>
      )}

      {householdId && hasNoCategories && (
        <div className="rounded-lg border p-6 space-y-2">
          <p className="text-lg font-medium">No spending categories set up yet.</p>
          <p className="text-muted-foreground">
            <a href="/settings" className="underline text-primary">Add them in Settings →</a>
          </p>
        </div>
      )}

      {householdId && !hasNoCategories && actuals.length === 0 && (
        <div className="rounded-lg border p-6 space-y-2">
          <p className="text-lg font-medium text-muted-foreground">No spending recorded yet.</p>
          <p className="text-muted-foreground">Tap &quot;Add {monthName}&quot; above to get started.</p>
        </div>
      )}

      {householdId && actuals.length > 0 && (
        <ActualsSummary actuals={actuals} categories={categories} />
      )}
    </div>
  );
}

function ActualsSummary({ actuals, categories }: { actuals: Actual[]; categories: Category[] }) {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const months = [...new Set(actuals.map((a) => `${a.year}-${String(a.month).padStart(2, "0")}`))]
    .sort()
    .reverse()
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Recent months</h2>
      {months.map((ym) => {
        const [yr, mo] = ym.split("-").map(Number);
        const label = new Date(yr, mo - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
        const monthActuals = actuals.filter((a) => a.year === yr && a.month === mo);
        const total = monthActuals.reduce((s, a) => s + a.amount_cents, 0);
        return (
          <div key={ym} className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium text-lg">{label}</span>
              <span className="font-bold">${Math.floor(total / 100).toLocaleString()}</span>
            </div>
            <div className="space-y-1">
              {monthActuals.map((a) => (
                <div key={a.category_id} className="flex justify-between text-base text-muted-foreground">
                  <span>{catMap.get(a.category_id)?.name ?? "Unknown"}</span>
                  <span>${Math.floor(a.amount_cents / 100).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
