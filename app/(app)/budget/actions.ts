"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

type ActualEntry = {
  categoryId: string;
  amountCents: number;
};

export async function saveCategoryActuals(
  year: number,
  month: number,
  entries: ActualEntry[],
): Promise<{ error?: string }> {
  if (!entries.length) return {};
  if (year < 2000 || year > 9999) return { error: "Invalid year." };
  if (month < 1 || month > 12) return { error: "Invalid month." };

  const now = new Date();
  const entryDate = new Date(year, month - 1, 1);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if (entryDate >= currentMonthStart) {
    return { error: "Cannot record a future or current month." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberRow } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!memberRow) return { error: "No household found." };
  const householdId = memberRow.household_id;

  const categoryIds = entries.map((e) => e.categoryId);
  const { data: validCategories } = await supabase
    .from("budget_categories")
    .select("id")
    .eq("household_id", householdId)
    .in("id", categoryIds);

  const validIds = new Set((validCategories ?? []).map((c) => c.id));
  const validEntries = entries.filter((e) => validIds.has(e.categoryId));
  if (!validEntries.length) return {};

  const rows = validEntries.map((e) => ({
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
    metadata: { year, month, count: validEntries.length },
  });

  revalidatePath("/budget");
  return {};
}
