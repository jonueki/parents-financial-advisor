"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

type ActualEntry = {
  categoryId: string;
  householdId: string;
  year: number;
  month: number;
  amountCents: number;
};

export async function saveCategoryActuals(entries: ActualEntry[]) {
  if (entries.length === 0) return;

  const supabase = await createSupabaseServerClient();

  const rows = entries.map((e) => ({
    household_id: e.householdId,
    category_id: e.categoryId,
    year: e.year,
    month: e.month,
    amount_cents: e.amountCents,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("category_actuals")
    .upsert(rows, { onConflict: "category_id,year,month" });

  if (error) throw new Error(error.message);

  const householdId = entries[0].householdId;
  await logAudit({
    action: "category_actual_recorded",
    householdId,
    targetTable: "category_actuals",
    metadata: {
      year: entries[0].year,
      month: entries[0].month,
      count: entries.length,
    },
  });

  revalidatePath("/budget");
}
