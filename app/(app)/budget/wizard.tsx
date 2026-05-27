"use client";

import { useState, useEffect } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { saveCategoryActuals } from "./actions";

type Category = { id: string; name: string; monthly_budget_cents: number | null };
type Actual = { category_id: string; year: number; month: number; amount_cents: number };

interface BudgetWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  categories: Category[];
  existingActuals: Actual[];
  defaultMonth: { year: number; month: number };
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function formatDollars(cents: number | null): string {
  if (cents === null) return "";
  return `$${Math.floor(cents / 100).toLocaleString()}`;
}

function parseDollars(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = parseInt(cleaned, 10);
  if (isNaN(n) || n < 0 || n > 999999) return null;
  return n * 100;
}

// Generate last 12 months as options (past only, no future)
function getMonthOptions(): { year: number; month: number; label: string }[] {
  const now = new Date();
  const options = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return options;
}

export function BudgetWizard({
  open, onOpenChange, householdId, categories, existingActuals, defaultMonth,
}: BudgetWizardProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // STEP -1 = month selector; 0..N-1 = categories; N = summary
  const [step, setStep] = useState(-1);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  // entries: null = skipped, number = amount_cents
  const [entries, setEntries] = useState<Record<string, number | null>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const monthOptions = getMonthOptions();
  const totalSteps = categories.length; // category steps only (not counting month selector or summary)

  // Reset when opened
  useEffect(() => {
    if (open) {
      setStep(-1);
      setSelectedMonth(defaultMonth);
      const initial: Record<string, number | null> = {};
      const initInputs: Record<string, string> = {};
      categories.forEach((cat) => {
        const existing = existingActuals.find((a) => a.category_id === cat.id);
        initial[cat.id] = existing ? existing.amount_cents : null;
        initInputs[cat.id] = existing ? String(Math.floor(existing.amount_cents / 100)) : "";
      });
      setEntries(initial);
      setInputValues(initInputs);
    }
  }, [open, defaultMonth, categories, existingActuals]);

  const hasEnteredAnything = Object.values(entries).some((v) => v !== null);

  function handleRequestClose() {
    if (step >= 0 && hasEnteredAnything) {
      setConfirmDiscard(true);
    } else {
      onOpenChange(false);
    }
  }

  function confirmClose() {
    setConfirmDiscard(false);
    onOpenChange(false);
  }

  function handleInputChange(catId: string, value: string) {
    setInputValues((prev) => ({ ...prev, [catId]: value }));
  }

  function handleInputBlur(catId: string) {
    const raw = inputValues[catId];
    const cents = parseDollars(raw);
    if (cents !== null) {
      setEntries((prev) => ({ ...prev, [catId]: cents }));
      setInputValues((prev) => ({ ...prev, [catId]: String(Math.floor(cents / 100)) }));
    }
  }

  function handleInputFocus(catId: string) {
    // Show raw number on focus
    const val = entries[catId];
    if (val !== null && val !== undefined) {
      setInputValues((prev) => ({ ...prev, [catId]: String(Math.floor(val / 100)) }));
    }
  }

  function handleNext(catId: string) {
    // Save current input before advancing
    const raw = inputValues[catId];
    const cents = parseDollars(raw);
    // if they typed something valid, save it; if blank, leave as-is (already set)
    if (raw.trim() !== "" && cents !== null) {
      setEntries((prev) => ({ ...prev, [catId]: cents }));
    }
    setStep((s) => s + 1);
  }

  function handleSkip() {
    // Skip = don't touch this category's entry
    setStep((s) => s + 1);
  }

  function handlePrevious() {
    setStep((s) => s - 1);
  }

  async function handleSave() {
    setSaving(true);
    const toSave = Object.entries(entries)
      .filter(([, v]) => v !== null)
      .map(([categoryId, amountCents]) => ({ categoryId, amountCents: amountCents! }));
    try {
      await saveCategoryActuals(householdId, selectedMonth.year, selectedMonth.month, toSave);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const currentCategory = step >= 0 && step < categories.length ? categories[step] : null;
  const isOnSummary = step === categories.length;
  const isOnMonthSelect = step === -1;

  function renderContent() {
    if (isOnMonthSelect) {
      return <MonthSelectStep
        options={monthOptions}
        selected={selectedMonth}
        onSelect={setSelectedMonth}
        onNext={() => setStep(0)}
      />;
    }

    if (currentCategory && !isOnSummary) {
      const catId = currentCategory.id;
      const inputVal = inputValues[catId] ?? "";
      const monthLabel = MONTH_NAMES[selectedMonth.month - 1];
      return (
        <CategoryStep
          category={currentCategory}
          monthLabel={monthLabel}
          stepNumber={step + 1}
          totalSteps={totalSteps}
          inputValue={inputVal}
          onInputChange={(v) => handleInputChange(catId, v)}
          onInputBlur={() => handleInputBlur(catId)}
          onInputFocus={() => handleInputFocus(catId)}
          onNext={() => handleNext(catId)}
          onSkip={handleSkip}
          onPrevious={step === 0 ? () => setStep(-1) : handlePrevious}
        />
      );
    }

    if (isOnSummary) {
      return (
        <SummaryStep
          categories={categories}
          entries={entries}
          selectedMonth={selectedMonth}
          onSave={handleSave}
          onBack={() => setStep(categories.length - 1)}
          saving={saving}
        />
      );
    }

    return null;
  }

  if (isDesktop) {
    return (
      <>
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleRequestClose(); else onOpenChange(o); }}>
          <DialogContent className="max-w-md" onInteractOutside={(e) => { e.preventDefault(); handleRequestClose(); }}>
            <DialogHeader>
              <DialogTitle>Record Monthly Spending</DialogTitle>
              <DialogDescription>Enter your spending totals for each category.</DialogDescription>
            </DialogHeader>
            {renderContent()}
          </DialogContent>
        </Dialog>
        <DiscardConfirmDialog
          open={confirmDiscard}
          onConfirm={confirmClose}
          onCancel={() => setConfirmDiscard(false)}
        />
      </>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) handleRequestClose(); else onOpenChange(o); }}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-xl" onInteractOutside={(e) => { e.preventDefault(); handleRequestClose(); }}>
          <SheetHeader>
            <SheetTitle>Record Monthly Spending</SheetTitle>
            <SheetDescription>Enter your spending totals for each category.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{renderContent()}</div>
        </SheetContent>
      </Sheet>
      <DiscardConfirmDialog
        open={confirmDiscard}
        onConfirm={confirmClose}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

function MonthSelectStep({
  options, selected, onSelect, onNext,
}: {
  options: { year: number; month: number; label: string }[];
  selected: { year: number; month: number };
  onSelect: (m: { year: number; month: number }) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6 py-2">
      <div className="space-y-2">
        <Label className="text-[18px]">Which month are you recording?</Label>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = opt.year === selected.year && opt.month === selected.month;
            return (
              <button
                key={`${opt.year}-${opt.month}`}
                type="button"
                onClick={() => onSelect(opt)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-[18px] min-h-[56px] transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border hover:bg-accent"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <Button onClick={onNext} className="w-full">
        Next →
      </Button>
    </div>
  );
}

function CategoryStep({
  category, monthLabel, stepNumber, totalSteps,
  inputValue, onInputChange, onInputBlur, onInputFocus,
  onNext, onSkip, onPrevious,
}: {
  category: Category;
  monthLabel: string;
  stepNumber: number;
  totalSteps: number;
  inputValue: string;
  onInputChange: (v: string) => void;
  onInputBlur: () => void;
  onInputFocus: () => void;
  onNext: () => void;
  onSkip: () => void;
  onPrevious: () => void;
}) {
  const progressPct = (stepNumber / totalSteps) * 100;

  return (
    <div className="space-y-6 py-2">
      <div className="space-y-2">
        <div className="flex justify-between items-center text-base text-muted-foreground">
          <span>Step {stepNumber} of {totalSteps}</span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{category.name}</h2>
        {category.monthly_budget_cents !== null && (
          <p className="text-base text-muted-foreground">
            Budget: {formatDollars(category.monthly_budget_cents)}/month
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`amount-${category.id}`} className="text-[18px]">
          About how much did you spend in {monthLabel}?
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground">$</span>
          <Input
            id={`amount-${category.id}`}
            type="number"
            min={0}
            max={999999}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onBlur={onInputBlur}
            onFocus={onInputFocus}
            placeholder="0"
            className="pl-8"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Button onClick={onNext} className="w-full">
          {stepNumber === totalSteps ? "Review →" : "Next →"}
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onPrevious} className="flex-1 h-14">
            ← Back
          </Button>
          <Button variant="ghost" onClick={onSkip} className="flex-1 h-14">
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryStep({
  categories, entries, selectedMonth, onSave, onBack, saving,
}: {
  categories: Category[];
  entries: Record<string, number | null>;
  selectedMonth: { year: number; month: number };
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  const monthLabel = `${MONTH_NAMES[selectedMonth.month - 1]} ${selectedMonth.year}`;

  return (
    <div className="space-y-6 py-2">
      <div>
        <h2 className="text-xl font-semibold">Review: {monthLabel}</h2>
        <p className="text-base text-muted-foreground mt-1">Check your entries before saving.</p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-[18px]">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b last:border-0">
                <td className="px-4 py-3">{cat.name}</td>
                <td className="px-4 py-3 text-right">
                  {entries[cat.id] !== null && entries[cat.id] !== undefined
                    ? formatDollars(entries[cat.id]!)
                    : <span className="text-muted-foreground italic">Skipped</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <Button onClick={onSave} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onBack} className="w-full h-14">
          ← Go back
        </Button>
      </div>
    </div>
  );
}

function DiscardConfirmDialog({
  open, onConfirm, onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            Your entries won&apos;t be saved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Leave</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
