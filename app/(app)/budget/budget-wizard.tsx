"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Link from "next/link";
import { saveCategoryActuals } from "./actions";

export type Category = {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
};

// "year-month" -> { categoryId: amountCents }
export type ActualsMap = Record<string, Record<string, number>>;

type Props = {
  householdId: string;
  categories: Category[];
  actualsMap: ActualsMap;
  defaultMonth: { year: number; month: number };
  showBanner: boolean;
  bannerMonthLabel: string;
  hasAnyActuals: boolean;
  lastMonth: { year: number; month: number };
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}

function centsToDisplayDollars(cents: number): string {
  return Math.round(cents / 100).toLocaleString("en-US");
}

function centsToFormattedDollars(cents: number): string {
  return "$" + centsToDisplayDollars(cents);
}

// ---------------------------------------------------------------------------
// MonthPicker
// ---------------------------------------------------------------------------

function MonthPicker({
  selectedYear,
  selectedMonth,
  onChange,
  onNext,
}: {
  selectedYear: number;
  selectedMonth: number;
  onChange: (year: number, month: number) => void;
  onNext: () => void;
}) {
  const now = new Date();
  const options: { year: number; month: number; label: string }[] = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }

  return (
    <div className="flex flex-col gap-6 px-6 pb-8 pt-2">
      <div>
        <h2 className="text-xl font-semibold">Which month are you recording?</h2>
        <p className="mt-1 text-base text-neutral-500">
          Select the month you want to add spending totals for.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="month-select" className="text-base font-medium">
          Month
        </label>
        <select
          id="month-select"
          className="min-h-[56px] rounded-lg border border-neutral-300 px-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
          value={`${selectedYear}-${selectedMonth}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            onChange(y, m);
          }}
        >
          {options.map((o) => (
            <option
              key={`${o.year}-${o.month}`}
              value={`${o.year}-${o.month}`}
            >
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="min-h-[56px] w-full rounded-xl bg-blue-700 text-lg font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
        onClick={onNext}
      >
        Next
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryStep
// ---------------------------------------------------------------------------

function CategoryStep({
  category,
  selectedMonth,
  selectedYear,
  initialValue,
  stepNumber,
  totalSteps,
  isFirst,
  onNext,
  onSkip,
  onPrev,
}: {
  category: Category;
  selectedMonth: number;
  selectedYear: number;
  initialValue: number | null;
  stepNumber: number;
  totalSteps: number;
  isFirst: boolean;
  onNext: (amountCents: number) => void;
  onSkip: () => void;
  onPrev: () => void;
}) {
  const [rawInput, setRawInput] = useState(() => {
    if (initialValue === null) return "";
    return centsToDisplayDollars(initialValue);
  });
  const [error, setError] = useState<string | null>(null);

  const monthName = MONTH_NAMES[selectedMonth - 1];
  const progressPct = Math.round((stepNumber / totalSteps) * 100);

  function parseCurrentInput(): number | null {
    const stripped = rawInput.replace(/[,\s]/g, "");
    if (stripped === "") return null;
    const n = Number(stripped);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 999999)
      return null;
    return n;
  }

  function handleNext() {
    const dollars = parseCurrentInput();
    if (dollars === null) {
      setError("Enter a whole dollar amount between $0 and $999,999, or use Skip.");
      return;
    }
    setError(null);
    onNext(dollars * 100);
  }

  function handleBlur() {
    const dollars = parseCurrentInput();
    if (dollars !== null) {
      setRawInput(dollars.toLocaleString("en-US"));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setRawInput(e.target.value.replace(/[^0-9,]/g, ""));
  }

  return (
    <div className="flex flex-col gap-6 px-6 pb-8 pt-2">
      {/* Progress */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>Step {stepNumber} of {totalSteps}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-blue-700 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Category heading */}
      <div>
        <h2 className="text-xl font-semibold">{category.name}</h2>
        {category.monthly_budget_cents !== null && (
          <p className="mt-1 text-base text-neutral-500">
            Budget: {centsToFormattedDollars(category.monthly_budget_cents)}/month
          </p>
        )}
      </div>

      {/* Amount input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="amount-input" className="text-lg font-medium">
          About how much did you spend in {monthName}?
        </label>
        <div className="flex items-center rounded-lg border border-neutral-300 focus-within:ring-2 focus-within:ring-blue-700">
          <span className="select-none pl-4 text-xl text-neutral-400">$</span>
          <input
            id="amount-input"
            type="text"
            inputMode="numeric"
            autoFocus
            className="min-h-[56px] flex-1 bg-transparent px-3 text-xl outline-none"
            placeholder="0"
            value={rawInput}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNext();
            }}
          />
        </div>
        {error && <p className="text-base text-red-600">{error}</p>}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="min-h-[56px] w-full rounded-xl bg-blue-700 text-lg font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
          onClick={handleNext}
        >
          Next
        </button>
        <button
          type="button"
          className="min-h-[44px] w-full text-base text-neutral-500 underline"
          onClick={onSkip}
        >
          Skip
        </button>
        <button
          type="button"
          className="min-h-[56px] w-full rounded-xl border border-neutral-300 text-base font-medium text-neutral-700 hover:bg-neutral-50"
          onClick={onPrev}
        >
          {isFirst ? "← Change month" : "← Previous"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryStep
// ---------------------------------------------------------------------------

function SummaryStep({
  categories,
  entries,
  selectedMonth,
  selectedYear,
  isSaving,
  saveError,
  onSave,
  onBack,
}: {
  categories: Category[];
  entries: Record<string, number | null>;
  selectedMonth: number;
  selectedYear: number;
  isSaving: boolean;
  saveError: string | null;
  onSave: () => void;
  onBack: () => void;
}) {
  const monthLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  return (
    <div className="flex flex-col gap-6 px-6 pb-8 pt-2">
      <div>
        <h2 className="text-xl font-semibold">Review {monthLabel}</h2>
        <p className="mt-1 text-base text-neutral-500">
          Confirm your entries before saving.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-3 text-left font-medium text-neutral-700">
                Category
              </th>
              <th className="px-4 py-3 text-right font-medium text-neutral-700">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const val = entries[cat.id];
              return (
                <tr
                  key={cat.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-4 py-3 text-neutral-800">{cat.name}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">
                    {val === null ? (
                      <span className="italic text-neutral-400">Skipped</span>
                    ) : (
                      centsToFormattedDollars(val)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {saveError && (
        <p className="text-base text-red-600">{saveError}</p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="min-h-[56px] w-full rounded-xl bg-blue-700 text-lg font-semibold text-white hover:bg-blue-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="min-h-[56px] w-full rounded-xl border border-neutral-300 text-base font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          onClick={onBack}
          disabled={isSaving}
        >
          ← Go back
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoCategoriesStep  (shown inside wizard when categories.length === 0)
// ---------------------------------------------------------------------------

function NoCategoriesStep() {
  return (
    <div className="flex flex-col gap-4 px-6 pb-8 pt-2">
      <h2 className="text-xl font-semibold">No categories yet</h2>
      <p className="text-base text-neutral-600">
        No spending categories set up yet.{" "}
        <Link href="/settings" className="text-blue-700 underline">
          Add them in Settings →
        </Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BudgetWizard (main export)
// ---------------------------------------------------------------------------

export default function BudgetWizard({
  householdId,
  categories,
  actualsMap,
  defaultMonth,
  showBanner,
  bannerMonthLabel,
  hasAnyActuals,
  lastMonth,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // step: -1 = month picker, 0..(n-1) = categories, n = summary
  const [step, setStep] = useState(-1);
  const [selectedYear, setSelectedYear] = useState(defaultMonth.year);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth.month);
  // entries: categoryId -> amountCents (null = skipped/not yet entered)
  const [entries, setEntries] = useState<Record<string, number | null>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const numCategories = categories.length;
  const lastMonthName = `${MONTH_NAMES[lastMonth.month - 1]} ${lastMonth.year}`;

  function openWizard() {
    setStep(-1);
    setSelectedYear(defaultMonth.year);
    setSelectedMonth(defaultMonth.month);
    setEntries({});
    setIsDirty(false);
    setSaveError(null);
    setIsOpen(true);
  }

  function handleOpenChange(open: boolean) {
    if (!open && isDirty) {
      setShowConfirmClose(true);
      return;
    }
    setIsOpen(open);
  }

  function confirmClose() {
    setShowConfirmClose(false);
    setIsOpen(false);
    setIsDirty(false);
  }

  function handleMonthChange(year: number, month: number) {
    setSelectedYear(year);
    setSelectedMonth(month);
    // Reset entries so startCategories() re-initialises from the new month's actuals.
    setEntries({});
  }

  function startCategories() {
    if (Object.keys(entries).length === 0) {
      // Pre-fill from existing actuals for the selected month.
      const key = monthKey(selectedYear, selectedMonth);
      const prefilled: Record<string, number | null> = {};
      for (const cat of categories) {
        const existing = actualsMap[key]?.[cat.id];
        prefilled[cat.id] = existing !== undefined ? existing : null;
      }
      setEntries(prefilled);
    }
    setIsDirty(true);
    setStep(0);
  }

  function handleCategoryNext(categoryId: string, amountCents: number) {
    setEntries((prev) => ({ ...prev, [categoryId]: amountCents }));
    setStep((s) => (s === numCategories - 1 ? numCategories : s + 1));
  }

  function handleCategorySkip(categoryId: string) {
    setEntries((prev) => ({ ...prev, [categoryId]: null }));
    setStep((s) => (s === numCategories - 1 ? numCategories : s + 1));
  }

  function handleCategoryPrev() {
    setStep((s) => (s === 0 ? -1 : s - 1));
  }

  async function handleSave() {
    const toSave = Object.entries(entries)
      .filter(([, cents]) => cents !== null)
      .map(([catId, cents]) => ({
        categoryId: catId,
        year: selectedYear,
        month: selectedMonth,
        amountCents: cents as number,
      }));

    setIsSaving(true);
    setSaveError(null);
    try {
      await saveCategoryActuals(householdId, toSave);
      setIsOpen(false);
      setIsDirty(false);
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      {/* Banner */}
      {showBanner && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="text-base font-medium text-blue-900">
            You haven&rsquo;t recorded {bannerMonthLabel} yet.
          </p>
          <button
            type="button"
            className="min-h-[44px] rounded-lg bg-blue-700 px-5 text-base font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
            onClick={openWizard}
          >
            Add now
          </button>
        </div>
      )}

      {/* Empty state when no actuals have ever been recorded */}
      {!hasAnyActuals && (
        <p className="mt-6 text-base text-neutral-600">
          No spending recorded yet. Tap &ldquo;Add {lastMonthName}&rdquo; to get started.
        </p>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Wizard — Sheet on mobile, Dialog on desktop                         */}
      {/* ------------------------------------------------------------------ */}
      <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content
            className={[
              // Mobile: slide up from bottom
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[90svh] flex-col overflow-y-auto rounded-t-2xl bg-white focus:outline-none",
              // Desktop ≥768px: centered dialog
              "md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:shadow-xl",
            ].join(" ")}
            aria-describedby={undefined}
          >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pb-1 pt-3 md:hidden">
              <div className="h-1 w-10 rounded-full bg-neutral-300" />
            </div>

            {/* Close button */}
            <div className="flex justify-end px-4 pt-2">
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                aria-label="Close"
                onClick={() => handleOpenChange(false)}
              >
                ✕
              </button>
            </div>

            {/* Wizard screens */}
            {numCategories === 0 && <NoCategoriesStep />}

            {numCategories > 0 && step === -1 && (
              <MonthPicker
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                onChange={handleMonthChange}
                onNext={startCategories}
              />
            )}

            {numCategories > 0 && step >= 0 && step < numCategories && (
              <CategoryStep
                key={`cat-${step}-${selectedYear}-${selectedMonth}`}
                category={categories[step]}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                initialValue={entries[categories[step].id] ?? null}
                stepNumber={step + 1}
                totalSteps={numCategories}
                isFirst={step === 0}
                onNext={(cents) => handleCategoryNext(categories[step].id, cents)}
                onSkip={() => handleCategorySkip(categories[step].id)}
                onPrev={handleCategoryPrev}
              />
            )}

            {numCategories > 0 && step === numCategories && (
              <SummaryStep
                categories={categories}
                entries={entries}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                isSaving={isSaving}
                saveError={saveError}
                onSave={handleSave}
                onBack={() => setStep(numCategories - 1)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ------------------------------------------------------------------ */}
      {/* Confirm-close alert                                                 */}
      {/* ------------------------------------------------------------------ */}
      <AlertDialog.Root open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl focus:outline-none">
            <AlertDialog.Title className="text-xl font-semibold">
              Leave without saving?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-base text-neutral-600">
              Your entries won&rsquo;t be saved.
            </AlertDialog.Description>
            <div className="mt-6 flex flex-col gap-3">
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  className="min-h-[56px] w-full rounded-xl bg-neutral-900 text-base font-semibold text-white hover:bg-neutral-800"
                  onClick={confirmClose}
                >
                  Leave
                </button>
              </AlertDialog.Action>
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className="min-h-[56px] w-full rounded-xl border border-neutral-300 text-base font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Keep editing
                </button>
              </AlertDialog.Cancel>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
