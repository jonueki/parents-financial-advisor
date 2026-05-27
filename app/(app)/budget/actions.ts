"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type ActualEntry = {
  categoryId: string;
  amountCents: number;
};

export async function fetchActualsForMonth(
  householdId: string,
  year: number,
  month: number,
): Promise<{ categoryId: string; amountCents: number }[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("category_actuals")
    .select("category_id, amount_cents")
    .eq("household_id", householdId)
    .eq("year", year)
    .eq("month", month);
  return (data ?? []).map((r) => ({
    categoryId: r.category_id as string,
    amountCents: r.amount_cents as number,
  }));
}

export async function saveActuals(
  householdId: string,
  year: number,
  month: number,
  entries: ActualEntry[],
): Promise<{ error: string | null }> {
  if (entries.length === 0) return { error: null };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return { error: "Invalid date" };
  }

  const rows = entries.map((e) => ({
    household_id: householdId,
    category_id: e.categoryId,
    year,
    month,
    amount_cents: e.amountCents,
  }));

  const { error } = await supabase
    .from("category_actuals")
    .upsert(rows, { onConflict: "category_id,year,month" });

  if (error) return { error: error.message };

  await logAudit({
    action: "category_actual_recorded",
    householdId,
    metadata: { year, month, count: entries.length },
  });

  revalidatePath("/budget");
  return { error: null };
}
