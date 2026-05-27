"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import EntryWizard from "./entry-wizard";
import type { CategoryRow } from "./actions";

interface Props {
  monthLabel: string;
  householdId: string;
  year: number;
  month: number;
  categories: CategoryRow[];
}

export default function BudgetBanner({
  monthLabel,
  householdId,
  year,
  month,
  categories,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base font-medium">
          You haven&rsquo;t recorded {monthLabel} yet. Add now.
        </p>
        <Button
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto"
        >
          Add {monthLabel}
        </Button>
      </div>

      <EntryWizard
        open={open}
        onOpenChange={setOpen}
        householdId={householdId}
        defaultYear={year}
        defaultMonth={month}
        categories={categories}
      />
    </>
  );
}
