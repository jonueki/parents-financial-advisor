"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

type ActualEntry = {
  categoryId: string;
  amountCents: number;
};

type SaveResult = { ok: true } | { ok: false; message: string };

// RFC-4122-ish UUID; permissive enough for any v1-v8.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_ENTRIES = 100;
const MAX_AMOUNT_CENTS = 100_000_000; // $1,000,000 — generous ceiling, sanity bound.

export async function saveCategoryActuals(
  householdId: string,
  year: number,
  month: number,
  entries: ActualEntry[],
): Promise<SaveResult> {
  // ----- Input validation (before any DB call) -----
  if (typeof householdId !== "string" || !UUID_RE.test(householdId)) {
    return { ok: false, message: "Invalid household." };
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, message: "Year must be between 2000 and 2100." };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, message: "Month must be between 1 and 12." };
  }
  if (!Array.isArray(entries)) {
    return { ok: false, message: "Invalid entries." };
  }
  if (entries.length > MAX_ENTRIES) {
    return {
      ok: false,
      message: `Too many entries (max ${MAX_ENTRIES}).`,
    };
  }
  for (const e of entries) {
    if (
      !e ||
      typeof e.categoryId !== "string" ||
      !UUID_RE.test(e.categoryId)
    ) {
      return { ok: false, message: "Invalid category id." };
    }
    if (
      !Number.isInteger(e.amountCents) ||
      e.amountCents < 0 ||
      e.amountCents > MAX_AMOUNT_CENTS
    ) {
      return { ok: false, message: "Amount is out of range." };
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  if (!entries.length) return { ok: true };

  // ----- Cross-household integrity: confirm every categoryId belongs to
  // the supplied householdId. RLS verifies the row's household_id on the
  // upsert, but not that the *category* belongs to that household, so a
  // multi-household member could otherwise write actuals against the
  // wrong category. Filter here before writing.
  const categoryIds = Array.from(new Set(entries.map((e) => e.categoryId)));
  const { data: ownedCategories, error: catError } = await supabase
    .from("budget_categories")
    .select("id")
    .eq("household_id", householdId)
    .in("id", categoryIds);

  if (catError) {
    return {
      ok: false,
      message: "Could not verify categories. Please try again.",
    };
  }
  const ownedIds = new Set((ownedCategories ?? []).map((c) => c.id));
  for (const id of categoryIds) {
    if (!ownedIds.has(id)) {
      return {
        ok: false,
        message: "One or more categories don't belong to this household.",
      };
    }
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

  if (error) {
    // Don't leak raw Postgres errors to the UI.
    return { ok: false, message: "Could not save spending. Please try again." };
  }

  await logAudit({
    action: "category_actual_recorded",
    householdId,
    metadata: { year, month, count: entries.length },
  });

  revalidatePath("/budget");
  return { ok: true };
}
