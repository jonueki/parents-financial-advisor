"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CategoryActualEntry = {
  categoryId: string;
  amountCents: number;
};

export async function saveCategoryActuals(
  householdId: string,
  year: number,
  month: number,
  entries: CategoryActualEntry[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (entries.length === 0) return { success: true };

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

  if (error) throw new Error(error.message);

  revalidatePath("/budget");
  return { success: true };
}
