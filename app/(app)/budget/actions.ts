"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CategoryRow {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
}

export interface ActualRow {
  category_id: string;
  year: number;
  month: number;
  amount_cents: number;
}

export interface WizardEntry {
  categoryId: string;
  amountCents: number | null; // null = skipped
}

export async function getHouseholdId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .limit(1)
    .single();

  return data?.household_id ?? null;
}

export async function getBudgetPageData(householdId: string): Promise<{
  categories: CategoryRow[];
  latestActualMonth: { year: number; month: number } | null;
  hasActualsForCurrentMonth: boolean;
}> {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("budget_categories")
    .select("id, name, monthly_budget_cents")
    .eq("household_id", householdId)
    .order("sort_order");

  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear =
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const { data: actuals } = await supabase
    .from("category_actuals")
    .select("year, month")
    .eq("household_id", householdId)
    .eq("year", prevYear)
    .eq("month", prevMonth)
    .limit(1);

  return {
    categories: categories ?? [],
    latestActualMonth: { year: prevYear, month: prevMonth },
    hasActualsForCurrentMonth: (actuals?.length ?? 0) > 0,
  };
}

export async function getExistingActuals(
  householdId: string,
  year: number,
  month: number
): Promise<ActualRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("category_actuals")
    .select("category_id, year, month, amount_cents")
    .eq("household_id", householdId)
    .eq("year", year)
    .eq("month", month);

  return data ?? [];
}

export async function saveWizardEntries(
  householdId: string,
  year: number,
  month: number,
  entries: WizardEntry[]
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const rows = entries
    .filter((e) => e.amountCents !== null)
    .map((e) => ({
      household_id: householdId,
      category_id: e.categoryId,
      year,
      month,
      amount_cents: e.amountCents as number,
    }));

  if (rows.length === 0) {
    revalidatePath("/budget");
    return { error: null };
  }

  const { error } = await supabase
    .from("category_actuals")
    .upsert(rows, { onConflict: "category_id,year,month" });

  if (error) return { error: error.message };

  revalidatePath("/budget");
  return { error: null };
}
