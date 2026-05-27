"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BudgetWizard } from "./wizard";

type Category = { id: string; name: string; monthly_budget_cents: number | null };
type Actual = { category_id: string; year: number; month: number; amount_cents: number };

interface BudgetBannerProps {
  monthName: string;
  householdId: string;
  categories: Category[];
  existingActuals: Actual[];
  prevMonth: { year: number; month: number };
}

export function BudgetBanner({ monthName, householdId, categories, existingActuals, prevMonth }: BudgetBannerProps) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4">
        <p className="text-base font-medium">
          You haven&apos;t recorded <strong>{monthName}</strong> yet.
        </p>
        <Button onClick={() => setWizardOpen(true)} className="shrink-0">
          Add now
        </Button>
      </div>
      <BudgetWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        householdId={householdId}
        categories={categories}
        existingActuals={existingActuals}
        defaultMonth={prevMonth}
      />
    </>
  );
}
