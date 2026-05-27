"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

type SaveEntry = { categoryId: string; amountCents: number };

type SaveResult = { error?: string };

export async function saveMonthlyActuals(args: {
  householdId: string;
  year: number;
  month: number;
  entries: SaveEntry[];
}): Promise<SaveResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Confirm caller is actually a member of the target household.
  const { data: member } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("household_id", args.householdId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!member) return { error: "You are not a member of this household." };

  if (args.entries.length === 0) {
    revalidatePath("/budget");
    return {};
  }

  const rows = args.entries.map((e) => ({
    household_id: args.householdId,
    category_id: e.categoryId,
    year: args.year,
    month: args.month,
    amount_cents: e.amountCents,
  }));

  const { error } = await supabase
    .from("category_actuals")
    .upsert(rows, { onConflict: "category_id,year,month" });

  if (error) return { error: error.message };

  await logAudit({
    action: "category_actual_recorded",
    householdId: args.householdId,
    metadata: { year: args.year, month: args.month, count: args.entries.length },
  });

  revalidatePath("/budget");
  return {};
}
