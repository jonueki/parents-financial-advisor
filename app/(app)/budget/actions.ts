"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

type ActualEntry = {
  categoryId: string;
  amountCents: number;
};

type SaveResult = { ok: true } | { ok: false; message: string };

export async function saveCategoryActuals(
  householdId: string,
  year: number,
  month: number,
  entries: ActualEntry[],
): Promise<SaveResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  if (!entries.length) return { ok: true };

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

  if (error) return { ok: false, message: error.message };

  await logAudit({
    action: "category_actual_recorded",
    householdId,
    metadata: { year, month, count: entries.length },
  });

  revalidatePath("/budget");
  return { ok: true };
}
