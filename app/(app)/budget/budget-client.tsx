"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EntryWizard, type Category, type ActualRow } from "./entry-wizard";

function getMostRecentUnrecorded(actuals: ActualRow[]): {
  year: number;
  month: number;
} {
  const now = new Date();
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    if (!actuals.some((a) => a.year === y && a.month === m)) {
      return { year: y, month: m };
    }
  }
  // All 12 months recorded — default to last month (user may want to update)
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function formatMonthYear(year: number, month: number): string {
  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

type Props = {
  householdId: string;
  categories: Category[];
  actuals: ActualRow[];
  showBanner: boolean;
  bannerMonthLabel: string;
  hasAnyActuals: boolean;
};

export function BudgetClient({
  householdId,
  categories,
  actuals,
  showBanner,
  bannerMonthLabel,
  hasAnyActuals,
}: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);

  const defaultMonth = getMostRecentUnrecorded(actuals);

  return (
    <>
      {/* Banner: unrecorded recent month */}
      {showBanner && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
          <p className="text-base text-blue-900">
            You haven&apos;t recorded {bannerMonthLabel} yet.
          </p>
          <Button
            size="sm"
            onClick={() => setWizardOpen(true)}
            className="shrink-0"
          >
            Add now
          </Button>
        </div>
      )}

      {/* Empty state: no actuals at all */}
      {!hasAnyActuals && categories.length > 0 && (
        <p className="text-base text-neutral-600">
          No spending recorded yet. Tap &ldquo;Add {bannerMonthLabel}&rdquo; to
          get started.
        </p>
      )}

      {/* Empty state: no categories configured */}
      {categories.length === 0 && (
        <p className="text-base text-neutral-600">
          No spending categories set up yet.{" "}
          <Link href="/settings" className="text-blue-600 hover:underline">
            Add them in Settings →
          </Link>
        </p>
      )}

      {/* Wizard */}
      {categories.length > 0 && (
        <EntryWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          householdId={householdId}
          categories={categories}
          actuals={actuals}
          defaultYear={defaultMonth.year}
          defaultMonth={defaultMonth.month}
        />
      )}
    </>
  );
}
