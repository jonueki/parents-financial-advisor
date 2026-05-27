"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type ActualEntry = {
  categoryId: string;
  year: number;
  month: number;
  amountCents: number;
};

export async function saveCategoryActuals(
  householdId: string,
  entries: ActualEntry[],
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  if (entries.length === 0) {
    revalidatePath("/budget");
    return;
  }

  const now = new Date().toISOString();
  const rows = entries.map((e) => ({
    household_id: householdId,
    category_id: e.categoryId,
    year: e.year,
    month: e.month,
    amount_cents: e.amountCents,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("category_actuals")
    .upsert(rows, { onConflict: "category_id,year,month" });

  if (error) throw new Error(error.message);

  await logAudit({
    action: "category_actual_recorded",
    householdId,
    metadata: {
      year: entries[0]?.year,
      month: entries[0]?.month,
      count: entries.length,
    },
  });

  revalidatePath("/budget");
}
