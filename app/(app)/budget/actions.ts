"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

type ActualEntry = {
  categoryId: string;
  amountCents: number;
};

export async function saveMonthActuals(
  householdId: string,
  year: number,
  month: number,
  entries: ActualEntry[],
): Promise<{ error: string | null }> {
  if (entries.length === 0) {
    revalidatePath("/budget");
    return { error: null };
  }

  const supabase = await createSupabaseServerClient();

  const rows = entries.map((e) => ({
    household_id: householdId,
    category_id: e.categoryId,
    year,
    month,
    amount_cents: e.amountCents,
    updated_at: new Date().toISOString(),
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
