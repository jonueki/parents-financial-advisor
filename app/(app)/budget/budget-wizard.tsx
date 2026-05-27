"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import { saveCategoryActuals } from "./actions";

export type Category = {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
};

export type ExistingActual = {
  category_id: string;
  year: number;
  month: number;
  amount_cents: number;
};

type Props = {
  householdId: string;
  categories: Category[];
  defaultYear: number;
  defaultMonth: number;
  allActuals: ExistingActual[];
};

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

function getAvailableMonths(): { year: number; month: number; label: string }[] {
  const now = new Date();
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = 1; i <= 12; i++) {
    let month = now.getMonth() + 1 - i;
    let year = now.getFullYear();
    if (month <= 0) {
      month += 12;
      year -= 1;
    }
    months.push({ year, month, label: `${MONTH_NAMES[month - 1]} ${year}` });
  }
  return months;
}

// null = skipped, number = dollar amount (integer)
type Entries = Record<string, number | null>;

type Step = "month" | "category" | "summary";

export default function BudgetWizardTrigger({
  householdId,
  categories,
  defaultYear,
  defaultMonth,
  allActuals,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  const [step, setStep] = useState<Step>("month");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [entries, setEntries] = useState<Entries>({});
  const [inputDigits, setInputDigits] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const availableMonths = getAvailableMonths();

  function existingDollars(categoryId: string, year: number, month: number): number | null {
    const row = allActuals.find(
      (a) => a.category_id === categoryId && a.year === year && a.month === month,
    );
    return row !== undefined ? Math.round(row.amount_cents / 100) : null;
  }

  function openWizard() {
    setStep("month");
    setCategoryIndex(0);
    setSelectedYear(defaultYear);
    setSelectedMonth(defaultMonth);
    setEntries({});
    setInputDigits("");
    setSaveError(null);
    setOpen(true);
  }

  function loadInputForCategory(index: number, year: number, month: number) {
    const cat = categories[index];
    const prev = entries[cat.id];
    if (prev !== undefined) {
      setInputDigits(prev !== null ? String(prev) : "");
    } else {
      const existing = existingDollars(cat.id, year, month);
      setInputDigits(existing !== null ? String(existing) : "");
    }
  }

  function handleMonthNext() {
    setCategoryIndex(0);
    setEntries({});
    loadInputForCategory(0, selectedYear, selectedMonth);
    setStep("category");
  }

  function commitCurrentInput(): number | null {
    const n = parseInt(inputDigits, 10);
    return inputDigits === "" || isNaN(n) ? null : n;
  }

  function handleCategoryNext() {
    const cat = categories[categoryIndex];
    const value = commitCurrentInput();
    const newEntries: Entries = { ...entries, [cat.id]: value };
    setEntries(newEntries);

    if (categoryIndex < categories.length - 1) {
      const nextIdx = categoryIndex + 1;
      const nextCat = categories[nextIdx];
      const prevEntry = newEntries[nextCat.id];
      if (prevEntry !== undefined) {
        setInputDigits(prevEntry !== null ? String(prevEntry) : "");
      } else {
        const existing = existingDollars(nextCat.id, selectedYear, selectedMonth);
        setInputDigits(existing !== null ? String(existing) : "");
      }
      setCategoryIndex(nextIdx);
    } else {
      setStep("summary");
    }
  }

  function handleCategorySkip() {
    const cat = categories[categoryIndex];
    const newEntries: Entries = { ...entries, [cat.id]: null };
    setEntries(newEntries);

    if (categoryIndex < categories.length - 1) {
      const nextIdx = categoryIndex + 1;
      const nextCat = categories[nextIdx];
      const prevEntry = newEntries[nextCat.id];
      if (prevEntry !== undefined) {
        setInputDigits(prevEntry !== null ? String(prevEntry) : "");
      } else {
        const existing = existingDollars(nextCat.id, selectedYear, selectedMonth);
        setInputDigits(existing !== null ? String(existing) : "");
      }
      setCategoryIndex(nextIdx);
    } else {
      setStep("summary");
    }
  }

  function handlePrevious() {
    if (step === "summary") {
      const lastIdx = categories.length - 1;
      const lastCat = categories[lastIdx];
      const prev = entries[lastCat.id];
      setInputDigits(prev !== null && prev !== undefined ? String(prev) : "");
      setCategoryIndex(lastIdx);
      setStep("category");
    } else if (step === "category") {
      if (categoryIndex === 0) {
        setStep("month");
      } else {
        const prevIdx = categoryIndex - 1;
        const prevCat = categories[prevIdx];
        const prev = entries[prevCat.id];
        setInputDigits(prev !== null && prev !== undefined ? String(prev) : "");
        setCategoryIndex(prevIdx);
      }
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const toSave = Object.entries(entries)
        .filter(([, val]) => val !== null)
        .map(([categoryId, dollars]) => ({
          categoryId,
          householdId,
          year: selectedYear,
          month: selectedMonth,
          amountCents: (dollars as number) * 100,
        }));

      await saveCategoryActuals(toSave);
      setOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleOpenChange(wantsOpen: boolean) {
    if (wantsOpen) {
      setOpen(true);
      return;
    }
    // User wants to close
    if (step === "category" || step === "summary") {
      setConfirmDismiss(true);
      // Don't set open=false; let AlertDialog handle the decision
    } else {
      setOpen(false);
    }
  }

  function handleConfirmLeave() {
    setConfirmDismiss(false);
    setOpen(false);
  }

  const currentCategory = step === "category" ? categories[categoryIndex] : null;
  const selectedMonthName = MONTH_NAMES[selectedMonth - 1];
  const displayValue =
    inputDigits !== "" && !inputFocused
      ? `$${parseInt(inputDigits, 10).toLocaleString()}`
      : inputDigits;

  return (
    <>
      {/* Trigger button in the banner */}
      <button
        onClick={openWizard}
        className="mt-3 flex min-h-[56px] w-full items-center justify-center rounded-lg bg-blue-700 px-4 text-base font-semibold text-white hover:bg-blue-800 active:bg-blue-900 sm:w-auto sm:px-6"
      >
        Add now
      </button>

      {/* Dismiss confirmation */}
      <AlertDialog.Root open={confirmDismiss} onOpenChange={setConfirmDismiss}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
            <AlertDialog.Title className="text-xl font-semibold">
              Leave without saving?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-base text-neutral-600">
              Your entries won&apos;t be saved.
            </AlertDialog.Description>
            <div className="mt-6 flex flex-col gap-3">
              <AlertDialog.Action asChild>
                <button
                  onClick={handleConfirmLeave}
                  className="flex min-h-[56px] w-full items-center justify-center rounded-lg bg-red-600 text-base font-semibold text-white hover:bg-red-700"
                >
                  Leave anyway
                </button>
              </AlertDialog.Action>
              <AlertDialog.Cancel asChild>
                <button className="flex min-h-[56px] w-full items-center justify-center rounded-lg border border-neutral-300 text-base font-medium hover:bg-neutral-50">
                  Keep editing
                </button>
              </AlertDialog.Cancel>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* Wizard: Sheet on mobile, Dialog on desktop */}
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content
            className={[
              // Mobile: slide from bottom
              "fixed bottom-0 left-0 right-0 z-50 max-h-[92svh] overflow-y-auto rounded-t-2xl bg-white",
              // Desktop: centered dialog
              "md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl",
            ].join(" ")}
            // Prevent Radix from closing on outside click so we can show our own confirmation
            onInteractOutside={(e) => {
              e.preventDefault();
              handleOpenChange(false);
            }}
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              handleOpenChange(false);
            }}
          >
            <div className="p-6">
              {/* ── Month selector step ── */}
              {step === "month" && (
                <div className="space-y-6">
                  <Dialog.Title className="text-2xl font-semibold">
                    Which month are you recording?
                  </Dialog.Title>
                  <div>
                    <label
                      htmlFor="month-select"
                      className="mb-2 block text-base font-medium"
                    >
                      Month
                    </label>
                    <select
                      id="month-select"
                      value={`${selectedYear}-${selectedMonth}`}
                      onChange={(e) => {
                        const [y, m] = e.target.value.split("-").map(Number);
                        setSelectedYear(y);
                        setSelectedMonth(m);
                      }}
                      className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {availableMonths.map((mo) => (
                        <option key={`${mo.year}-${mo.month}`} value={`${mo.year}-${mo.month}`}>
                          {mo.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleMonthNext}
                    className="flex min-h-[56px] w-full items-center justify-center rounded-lg bg-blue-700 text-base font-semibold text-white hover:bg-blue-800"
                  >
                    Next
                  </button>
                </div>
              )}

              {/* ── Category step ── */}
              {step === "category" && currentCategory && (
                <div className="space-y-6">
                  {/* Step indicator */}
                  <p className="text-sm font-medium text-neutral-500">
                    Step {categoryIndex + 1} of {categories.length}
                  </p>

                  <div>
                    <Dialog.Title className="text-2xl font-semibold">
                      {currentCategory.name}
                    </Dialog.Title>
                    {currentCategory.monthly_budget_cents !== null && (
                      <p className="mt-1 text-base text-neutral-500">
                        Budget: $
                        {Math.round(
                          currentCategory.monthly_budget_cents / 100,
                        ).toLocaleString()}
                        /month
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="amount-input"
                      className="mb-2 block text-base font-medium"
                    >
                      About how much did you spend in {selectedMonthName}?
                    </label>
                    <input
                      id="amount-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="$0"
                      value={displayValue}
                      onChange={(e) => {
                        setInputDigits(e.target.value.replace(/[^0-9]/g, ""));
                      }}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      className="w-full rounded-lg border border-neutral-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                      style={{ height: "56px" }}
                      min={0}
                      max={999999}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleCategoryNext}
                      className="flex min-h-[56px] w-full items-center justify-center rounded-lg bg-blue-700 text-base font-semibold text-white hover:bg-blue-800"
                    >
                      Next
                    </button>
                    <button
                      onClick={handleCategorySkip}
                      className="flex min-h-[56px] w-full items-center justify-center rounded-lg border border-neutral-300 text-base font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Skip
                    </button>
                    <button
                      onClick={handlePrevious}
                      className="flex min-h-[56px] w-full items-center justify-center rounded-lg text-base font-medium text-neutral-500 hover:bg-neutral-50"
                    >
                      Previous
                    </button>
                  </div>
                </div>
              )}

              {/* ── Summary step ── */}
              {step === "summary" && (
                <div className="space-y-6">
                  <Dialog.Title className="text-2xl font-semibold">
                    Review — {selectedMonthName} {selectedYear}
                  </Dialog.Title>

                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b border-neutral-200 text-left text-sm text-neutral-500">
                        <th className="pb-2 font-normal">Category</th>
                        <th className="pb-2 text-right font-normal">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => {
                        const val = entries[cat.id];
                        return (
                          <tr key={cat.id} className="border-b border-neutral-100">
                            <td className="py-3">{cat.name}</td>
                            <td className="py-3 text-right">
                              {val === null || val === undefined ? (
                                <span className="text-neutral-400">Skipped</span>
                              ) : (
                                `$${val.toLocaleString()}`
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {saveError && (
                    <p className="rounded-lg bg-red-50 px-4 py-3 text-base text-red-700">
                      {saveError}
                    </p>
                  )}

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex min-h-[56px] w-full items-center justify-center rounded-lg bg-blue-700 text-base font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                    >
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={handlePrevious}
                      disabled={isSaving}
                      className="flex min-h-[56px] w-full items-center justify-center rounded-lg border border-neutral-300 text-base font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      Go back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
