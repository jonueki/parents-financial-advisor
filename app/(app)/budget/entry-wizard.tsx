"use client";

import { useState, useCallback, useEffect } from "react";
import { X, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveMonthActuals } from "./actions";

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

function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function formatDollars(n: number): string {
  return "$" + new Intl.NumberFormat("en-US").format(n);
}

function getAvailableMonths(): { year: number; month: number }[] {
  const now = new Date();
  const months: { year: number; month: number }[] = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return months;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export type Category = {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
};

export type ActualRow = {
  category_id: string;
  year: number;
  month: number;
  amount_cents: number;
};

// An entry is either an explicit dollar amount or an explicit skip.
type Entry = { type: "amount"; dollars: number } | { type: "skipped" };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  categories: Category[];
  actuals: ActualRow[];
  defaultYear: number;
  defaultMonth: number;
};

const STEP_MONTH = 0;

export function EntryWizard({
  open,
  onOpenChange,
  householdId,
  categories,
  actuals,
  defaultYear,
  defaultMonth,
}: Props) {
  const isDesktop = useIsDesktop();

  const [step, setStep] = useState(STEP_MONTH);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  // Raw input strings per category (separate from saved entries so editing is smooth)
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const summaryStep = categories.length + 1;
  const availableMonths = getAvailableMonths();

  const populateForMonth = useCallback(
    (year: number, month: number) => {
      const existing = actuals.filter(
        (a) => a.year === year && a.month === month,
      );
      const preEntries: Record<string, Entry> = {};
      const preValues: Record<string, string> = {};
      for (const a of existing) {
        const dollars = Math.round(a.amount_cents / 100);
        preEntries[a.category_id] = { type: "amount", dollars };
        preValues[a.category_id] = String(dollars);
      }
      setEntries(preEntries);
      setInputValues(preValues);
    },
    [actuals],
  );

  function resetWizard() {
    setStep(STEP_MONTH);
    setSelectedYear(defaultYear);
    setSelectedMonth(defaultMonth);
    setEntries({});
    setInputValues({});
    setSubmitError(null);
    setIsSubmitting(false);
  }

  function hasEnteredValues(): boolean {
    return Object.values(entries).some((e) => e.type === "amount");
  }

  function handleRequestClose() {
    if (hasEnteredValues()) {
      setShowLeaveConfirm(true);
    } else {
      onOpenChange(false);
      resetWizard();
    }
  }

  function handleConfirmLeave() {
    setShowLeaveConfirm(false);
    onOpenChange(false);
    resetWizard();
  }

  function handleMonthSubmit() {
    populateForMonth(selectedYear, selectedMonth);
    setStep(1);
  }

  function commitCurrentCategory(categoryId: string) {
    const raw = (inputValues[categoryId] ?? "").replace(/[^0-9]/g, "");
    if (raw === "") {
      // Empty input treated the same as skip
      setEntries((prev) => ({ ...prev, [categoryId]: { type: "skipped" } }));
    } else {
      const dollars = Math.min(parseInt(raw, 10), 999999);
      setEntries((prev) => ({
        ...prev,
        [categoryId]: { type: "amount", dollars },
      }));
    }
  }

  function handleNext(categoryId: string) {
    commitCurrentCategory(categoryId);
    setStep((s) => s + 1);
  }

  function handleSkip(categoryId: string) {
    setEntries((prev) => ({ ...prev, [categoryId]: { type: "skipped" } }));
    setStep((s) => s + 1);
  }

  function handlePrevious(categoryId: string) {
    commitCurrentCategory(categoryId);
    setStep((s) => s - 1);
  }

  async function handleSave() {
    setIsSubmitting(true);
    setSubmitError(null);

    const toSave = categories
      .filter((cat) => entries[cat.id]?.type === "amount")
      .map((cat) => ({
        categoryId: cat.id,
        amountCents: (entries[cat.id] as { type: "amount"; dollars: number })
          .dollars * 100,
      }));

    const result = await saveMonthActuals(
      householdId,
      selectedYear,
      selectedMonth,
      toSave,
    );

    if (result.error) {
      setSubmitError(result.error);
      setIsSubmitting(false);
      return;
    }

    onOpenChange(false);
    resetWizard();
  }

  const currentCategory = step >= 1 && step < summaryStep ? categories[step - 1] : null;

  const wizardBody = (
    <div className="flex flex-col">
      {/* Header row: step info + close button */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {step === STEP_MONTH && (
            <p className="text-xl font-semibold">Select a month</p>
          )}
          {currentCategory && (
            <>
              <p className="text-sm text-neutral-500">
                Step {step} of {categories.length}
              </p>
              <p className="mt-0.5 text-xl font-semibold">
                {currentCategory.name}
              </p>
              {currentCategory.monthly_budget_cents !== null && (
                <p className="mt-1 text-base text-neutral-500">
                  Budget:{" "}
                  {formatDollars(
                    Math.round(currentCategory.monthly_budget_cents / 100),
                  )}
                  /month
                </p>
              )}
            </>
          )}
          {step === summaryStep && (
            <p className="text-xl font-semibold">
              Review &amp; save —{" "}
              {formatMonthYear(selectedYear, selectedMonth)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRequestClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Step 0: Month selector */}
      {step === STEP_MONTH && (
        <div className="flex flex-col gap-4">
          <label htmlFor="month-select" className="text-base font-medium">
            Which month are you recording?
          </label>
          <select
            id="month-select"
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              setSelectedYear(y);
              setSelectedMonth(m);
            }}
            className="h-14 w-full rounded-md border border-neutral-300 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {availableMonths.map(({ year, month }) => (
              <option key={`${year}-${month}`} value={`${year}-${month}`}>
                {formatMonthYear(year, month)}
              </option>
            ))}
          </select>
          <Button className="w-full" onClick={handleMonthSubmit}>
            Next
          </Button>
        </div>
      )}

      {/* Steps 1..N: Category inputs */}
      {currentCategory && (
        <div className="flex flex-col gap-4">
          <label
            htmlFor={`amount-${currentCategory.id}`}
            className="text-base"
          >
            About how much did you spend in{" "}
            {MONTH_NAMES[selectedMonth - 1]}?
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-neutral-500">
              $
            </span>
            <Input
              id={`amount-${currentCategory.id}`}
              type="text"
              inputMode="numeric"
              className="pl-8"
              value={inputValues[currentCategory.id] ?? ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                if (raw === "" || parseInt(raw, 10) <= 999999) {
                  setInputValues((prev) => ({
                    ...prev,
                    [currentCategory.id]: raw,
                  }));
                }
              }}
              onBlur={() => {
                const raw = (
                  inputValues[currentCategory.id] ?? ""
                ).replace(/[^0-9]/g, "");
                if (raw !== "") {
                  const n = parseInt(raw, 10);
                  setInputValues((prev) => ({
                    ...prev,
                    [currentCategory.id]: new Intl.NumberFormat(
                      "en-US",
                    ).format(n),
                  }));
                }
              }}
              onFocus={() => {
                const formatted = inputValues[currentCategory.id] ?? "";
                const raw = formatted.replace(/,/g, "");
                setInputValues((prev) => ({
                  ...prev,
                  [currentCategory.id]: raw,
                }));
              }}
              placeholder="0"
              aria-label={`Spending for ${currentCategory.name} in ${formatMonthYear(selectedYear, selectedMonth)}`}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={() => handleNext(currentCategory.id)}
            >
              {step < categories.length ? "Next" : "Review"}
            </Button>
            {step > 1 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handlePrevious(currentCategory.id)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
            )}
            <button
              type="button"
              className="flex min-h-[56px] w-full items-center justify-center text-base text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              onClick={() => handleSkip(currentCategory.id)}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Summary step */}
      {step === summaryStep && (
        <div className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => {
                const entry = entries[cat.id];
                return (
                  <TableRow key={cat.id}>
                    <TableCell>{cat.name}</TableCell>
                    <TableCell className="text-right">
                      {entry?.type === "amount" ? (
                        formatDollars(entry.dollars)
                      ) : (
                        <span className="text-neutral-400">Skipped</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {submitError && (
            <p className="text-base text-red-600">{submitError}</p>
          )}

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setStep(summaryStep - 1)}
            disabled={isSubmitting}
          >
            Go back
          </Button>
        </div>
      )}
    </div>
  );

  const preventCloseProps = {
    hideCloseButton: true as const,
    onInteractOutside: (e: Event) => {
      e.preventDefault();
      handleRequestClose();
    },
    onEscapeKeyDown: (e: KeyboardEvent) => {
      e.preventDefault();
      handleRequestClose();
    },
  };

  return (
    <>
      {isDesktop ? (
        <Dialog
          open={open}
          onOpenChange={(v) => {
            if (!v) handleRequestClose();
          }}
        >
          <DialogContent {...preventCloseProps}>
            <DialogTitle className="sr-only">
              Monthly spending entry
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enter your spending for{" "}
              {formatMonthYear(selectedYear, selectedMonth)}
            </DialogDescription>
            {wizardBody}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet
          open={open}
          onOpenChange={(v) => {
            if (!v) handleRequestClose();
          }}
        >
          <SheetContent {...preventCloseProps}>
            <SheetTitle className="sr-only">Monthly spending entry</SheetTitle>
            <SheetDescription className="sr-only">
              Enter your spending for{" "}
              {formatMonthYear(selectedYear, selectedMonth)}
            </SheetDescription>
            {wizardBody}
          </SheetContent>
        </Sheet>
      )}

      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your entries won&apos;t be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeave}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
