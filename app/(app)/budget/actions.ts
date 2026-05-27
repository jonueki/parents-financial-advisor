"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function getActualsForMonth(
  householdId: string,
  year: number,
  month: number,
): Promise<Array<{ category_id: string; amount_cents: number }>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("category_actuals")
    .select("category_id, amount_cents")
    .eq("household_id", householdId)
    .eq("year", year)
    .eq("month", month);
  return data ?? [];
}

export type ActualEntry = { categoryId: string; amountCents: number };

export async function saveCategoryActuals(
  householdId: string,
  year: number,
  month: number,
  entries: ActualEntry[],
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  if (entries.length > 0) {
    const now = new Date().toISOString();
    const rows = entries.map((e) => ({
      household_id: householdId,
      category_id: e.categoryId,
      year,
      month,
      amount_cents: e.amountCents,
      updated_at: now,
    }));

    const { error } = await supabase
      .from("category_actuals")
      .upsert(rows, { onConflict: "category_id,year,month" });

    if (error) throw error;
  }

  await logAudit({
    action: "category_actual_recorded",
    householdId,
    metadata: { year, month, count: entries.length },
  });

  revalidatePath("/budget");
}
