"use client";

import { useState, useEffect, useCallback } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { saveWizardEntries, getExistingActuals } from "./actions";
import type { CategoryRow } from "./actions";

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

type Step =
  | { kind: "month-select" }
  | { kind: "category"; index: number }
  | { kind: "summary" };

interface WizardEntry {
  categoryId: string;
  amountCents: number | null; // null = skipped
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  defaultYear: number;
  defaultMonth: number;
  categories: CategoryRow[];
}

function formatDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function parseDollars(raw: string): number | null {
  const stripped = raw.replace(/[^0-9]/g, "");
  if (stripped === "") return null;
  const n = parseInt(stripped, 10);
  if (isNaN(n) || n < 0 || n > 999999) return null;
  return n * 100;
}

function MonthSelector({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  const now = new Date();
  // Months available: up to 12 months in the past, no future months
  const options: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
    options.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => {
        const selected = opt.year === year && opt.month === month;
        return (
          <button
            key={`${opt.year}-${opt.month}`}
            type="button"
            onClick={() => onChange(opt.year, opt.month)}
            className={`flex min-h-[56px] w-full items-center rounded-lg border px-4 py-3 text-left text-base transition-colors ${
              selected
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : "border-border hover:bg-muted/50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function AmountInput({
  value,
  onChange,
  monthLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  monthLabel: string;
}) {
  function handleBlur() {
    if (value === "") return;
    const cents = parseDollars(value);
    if (cents !== null) {
      onChange(`$${Math.round(cents / 100).toLocaleString("en-US")}`);
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    // Strip formatting on focus
    const stripped = e.target.value.replace(/[^0-9]/g, "");
    onChange(stripped);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9$,]/g, "");
    onChange(raw);
  }

  return (
    <div className="space-y-2">
      <label className="text-base font-medium">
        About how much did you spend in {monthLabel}?
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
          $
        </span>
        <Input
          type="text"
          inputMode="numeric"
          className="pl-8"
          placeholder="0"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          style={{ minHeight: 56 }}
        />
      </div>
    </div>
  );
}

function WizardBody({
  categories,
  householdId,
  defaultYear,
  defaultMonth,
  onClose,
}: {
  categories: CategoryRow[];
  householdId: string;
  defaultYear: number;
  defaultMonth: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "month-select" });
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [entries, setEntries] = useState<WizardEntry[]>(() =>
    categories.map((c) => ({ categoryId: c.id, amountCents: null }))
  );
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [loadingActuals, setLoadingActuals] = useState(false);

  const monthLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  // Load existing actuals when month changes
  useEffect(() => {
    if (step.kind !== "category" && step.kind !== "summary") return;
    setLoadingActuals(true);
    getExistingActuals(householdId, selectedYear, selectedMonth).then(
      (actuals) => {
        setEntries((prev) =>
          prev.map((e) => {
            const existing = actuals.find(
              (a) => a.category_id === e.categoryId
            );
            return existing
              ? { ...e, amountCents: existing.amount_cents }
              : e;
          })
        );
        setLoadingActuals(false);
      }
    );
  }, [householdId, selectedYear, selectedMonth, step.kind]);

  function startCategories() {
    setLoadingActuals(true);
    getExistingActuals(householdId, selectedYear, selectedMonth).then(
      (actuals) => {
        const newEntries = categories.map((c) => {
          const existing = actuals.find((a) => a.category_id === c.id);
          return {
            categoryId: c.id,
            amountCents: existing ? existing.amount_cents : null,
          };
        });
        setEntries(newEntries);

        // Pre-fill rawInputs from existing actuals
        const newRaw: Record<string, string> = {};
        actuals.forEach((a) => {
          newRaw[a.category_id] = formatDollars(a.amount_cents);
        });
        setRawInputs(newRaw);
        setLoadingActuals(false);
        setStep({ kind: "category", index: 0 });
      }
    );
  }

  function handleMonthNext() {
    startCategories();
  }

  function handleSkip(categoryId: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.categoryId === categoryId ? { ...e, amountCents: null } : e
      )
    );
    advanceCategory();
  }

  function handleNext(categoryId: string) {
    const raw = rawInputs[categoryId] ?? "";
    const cents = parseDollars(raw);
    setEntries((prev) =>
      prev.map((e) =>
        e.categoryId === categoryId ? { ...e, amountCents: cents } : e
      )
    );
    advanceCategory();
  }

  function advanceCategory() {
    if (step.kind !== "category") return;
    const next = step.index + 1;
    if (next >= categories.length) {
      setStep({ kind: "summary" });
    } else {
      setStep({ kind: "category", index: next });
    }
  }

  function handlePrevious() {
    if (step.kind === "category") {
      if (step.index === 0) {
        setStep({ kind: "month-select" });
      } else {
        setStep({ kind: "category", index: step.index - 1 });
      }
    } else if (step.kind === "summary") {
      setStep({ kind: "category", index: categories.length - 1 });
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const { error } = await saveWizardEntries(
      householdId,
      selectedYear,
      selectedMonth,
      entries
    );
    setSaving(false);
    if (error) {
      setSaveError(error);
    } else {
      onClose();
    }
  }

  function handleRawInput(categoryId: string, value: string) {
    setRawInputs((prev) => ({ ...prev, [categoryId]: value }));
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-4 py-4 text-center">
        <p className="text-base text-muted-foreground">
          No spending categories set up yet.{" "}
          <a href="/settings" className="text-primary underline">
            Add them in Settings →
          </a>
        </p>
      </div>
    );
  }

  // Month select step
  if (step.kind === "month-select") {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-base text-muted-foreground">
          Select the month you want to record spending for.
        </p>
        <MonthSelector
          year={selectedYear}
          month={selectedMonth}
          onChange={(y, m) => {
            setSelectedYear(y);
            setSelectedMonth(m);
          }}
        />
        <Button
          className="w-full"
          onClick={handleMonthNext}
          disabled={loadingActuals}
        >
          {loadingActuals ? "Loading…" : "Next"}
        </Button>
      </div>
    );
  }

  // Category step
  if (step.kind === "category") {
    const catIndex = step.index;
    const category = categories[catIndex];
    const rawValue = rawInputs[category.id] ?? "";

    const progressPct = Math.round(
      ((catIndex + 1) / (categories.length + 1)) * 100
    );

    return (
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Step {catIndex + 1} of {categories.length}
            </span>
          </div>
          <Progress value={progressPct} />
        </div>

        <div className="space-y-1">
          <h3 className="text-xl font-semibold">{category.name}</h3>
          {category.monthly_budget_cents !== null && (
            <p className="text-base text-muted-foreground">
              Budget: {formatDollars(category.monthly_budget_cents)}/month
            </p>
          )}
        </div>

        <AmountInput
          value={rawValue}
          onChange={(v) => handleRawInput(category.id, v)}
          monthLabel={MONTH_NAMES[selectedMonth - 1]}
        />

        <div className="flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={() => handleNext(category.id)}
            style={{ minHeight: 56 }}
          >
            {catIndex + 1 < categories.length ? "Next" : "Review"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => handleSkip(category.id)}
            style={{ minHeight: 56 }}
          >
            Skip
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handlePrevious}
            style={{ minHeight: 56 }}
          >
            Previous
          </Button>
        </div>
      </div>
    );
  }

  // Summary step
  if (step.kind === "summary") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-base text-muted-foreground">
            Review your entries for {monthLabel} before saving.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-semibold">Category</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const entry = entries.find((e) => e.categoryId === cat.id);
                return (
                  <tr key={cat.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{cat.name}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {entry?.amountCents !== null &&
                      entry?.amountCents !== undefined
                        ? formatDollars(entry.amountCents)
                        : "Skipped"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {saveError && (
          <p className="text-sm text-destructive">{saveError}</p>
        )}

        <div className="flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={saving}
            style={{ minHeight: 56 }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handlePrevious}
            style={{ minHeight: 56 }}
          >
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

export default function EntryWizard({
  open,
  onOpenChange,
  householdId,
  defaultYear,
  defaultMonth,
  categories,
}: Props) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const requestClose = useCallback(() => {
    setConfirmLeave(true);
  }, []);

  const confirmAndClose = useCallback(() => {
    setConfirmLeave(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const cancelLeave = useCallback(() => {
    setConfirmLeave(false);
  }, []);

  const title = "Record spending";

  const body = (
    <WizardBody
      categories={categories}
      householdId={householdId}
      defaultYear={defaultYear}
      defaultMonth={defaultMonth}
      onClose={() => onOpenChange(false)}
    />
  );

  return (
    <>
      <AlertDialog open={confirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your entries won&rsquo;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLeave}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={requestClose}>
          <DialogContent
            className="max-w-lg max-h-[90vh] overflow-y-auto"
            onPointerDownOutside={(e) => {
              e.preventDefault();
              requestClose();
            }}
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              requestClose();
            }}
          >
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={open} onOpenChange={requestClose}>
          <SheetContent
            side="bottom"
            className="max-h-[92vh] overflow-y-auto rounded-t-2xl pb-8"
            onPointerDownOutside={(e) => {
              e.preventDefault();
              requestClose();
            }}
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              requestClose();
            }}
          >
            <SheetHeader className="mb-4">
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
