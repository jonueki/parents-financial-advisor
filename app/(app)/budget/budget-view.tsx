"use client";

import {
  useState,
  useCallback,
  useEffect,
  useTransition,
  useMemo,
  useRef,
} from "react";
import Link from "next/link";
import { getActualsForMonth, saveCategoryActuals } from "./actions";
import type { Category } from "./page";

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

function monthLabel(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function parseDollars(s: string): number | null {
  const cleaned = s.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = parseInt(cleaned, 10);
  if (isNaN(n) || n < 0) return null;
  return Math.min(n, 999999);
}

function formatDollars(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// CategoryStep — one category input screen
// ---------------------------------------------------------------------------

type CategoryStepProps = {
  category: Category;
  index: number;
  total: number;
  month: string;
  initialValue: number | null;
  onNext: (dollarAmount: number | null) => void;
  onSkip: () => void;
  onPrev: () => void;
  onClose: () => void;
};

function CategoryStep({
  category,
  index,
  total,
  month,
  initialValue,
  onNext,
  onSkip,
  onPrev,
  onClose,
}: CategoryStepProps) {
  const [displayValue, setDisplayValue] = useState<string>(
    initialValue !== null ? formatDollars(initialValue) : "",
  );
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleFocus() {
    setFocused(true);
    // Strip formatting so the user can type raw digits
    const raw = parseDollars(displayValue);
    setDisplayValue(raw !== null ? String(raw) : "");
  }

  function handleBlur() {
    setFocused(false);
    const n = parseDollars(displayValue);
    setDisplayValue(n !== null ? formatDollars(n) : "");
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // While focused, allow only digits (strip everything else as typed)
    setDisplayValue(e.target.value.replace(/[^\d]/g, ""));
  }

  function handleNext() {
    const n = parseDollars(displayValue);
    onNext(n);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleNext();
  }

  const budgetText =
    category.monthly_budget_cents != null
      ? `Budget: ${formatDollars(Math.round(category.monthly_budget_cents / 100))}/month`
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            Step {index + 1} of {total}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">{category.name}</h2>
          {budgetText && (
            <p className="mt-0.5 text-base text-neutral-500">{budgetText}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Input */}
      <div>
        <label
          htmlFor="amount-input"
          className="mb-2 block text-base font-medium"
        >
          About how much did you spend in {month}?
        </label>
        <div className="flex items-center rounded-lg border border-neutral-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
          <span className="pl-4 text-base text-neutral-500" aria-hidden="true">
            $
          </span>
          <input
            ref={inputRef}
            id="amount-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={focused ? displayValue : displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="0"
            className="min-h-[56px] w-full rounded-lg bg-transparent px-3 text-base outline-none placeholder:text-neutral-400"
            aria-label={`Amount spent on ${category.name} in ${month}`}
          />
        </div>
      </div>

      {/* Footer buttons */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={handleNext}
          className="flex min-h-[56px] w-full items-center justify-center rounded-xl bg-blue-700 text-base font-semibold text-white hover:bg-blue-800"
        >
          {index < total - 1 ? "Next" : "Review"}
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onPrev}
            className="flex min-h-[56px] flex-1 items-center justify-center rounded-xl border border-neutral-300 text-base font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex min-h-[56px] flex-1 items-center justify-center rounded-xl border border-neutral-300 text-base font-medium text-neutral-500 hover:bg-neutral-50"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryStep — review all entries before saving
// ---------------------------------------------------------------------------

type EntryRecord = { dollarAmount: number | null; skipped: boolean };

type SummaryStepProps = {
  categories: Category[];
  entries: Record<string, EntryRecord>;
  month: string;
  onBack: () => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  saveError: string | null;
};

function SummaryStep({
  categories,
  entries,
  month,
  onBack,
  onSave,
  onClose,
  isSaving,
  saveError,
}: SummaryStepProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold">Review {month}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Summary table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-3 text-left font-semibold text-neutral-700">
                Category
              </th>
              <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, i) => {
              const entry = entries[cat.id];
              const isSkipped =
                !entry || entry.skipped || entry.dollarAmount === null;
              const label = isSkipped
                ? "Skipped"
                : formatDollars(entry.dollarAmount ?? 0);
              return (
                <tr
                  key={cat.id}
                  className={
                    i < categories.length - 1
                      ? "border-b border-neutral-100"
                      : ""
                  }
                >
                  <td className="px-4 py-3 text-neutral-900">{cat.name}</td>
                  <td
                    className={`px-4 py-3 text-right ${isSkipped ? "text-neutral-400" : "text-neutral-900"}`}
                  >
                    {label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {saveError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-base text-red-700">
          {saveError}
        </p>
      )}

      {/* Footer */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex min-h-[56px] w-full items-center justify-center rounded-xl bg-blue-700 text-base font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={isSaving}
          className="flex min-h-[56px] w-full items-center justify-center rounded-xl border border-neutral-300 text-base font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          Go back
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiscardConfirm — inline AlertDialog overlay
// ---------------------------------------------------------------------------

type DiscardConfirmProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

function DiscardConfirm({ onConfirm, onCancel }: DiscardConfirmProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="discard-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3
          id="discard-title"
          className="text-xl font-semibold text-neutral-900"
        >
          Leave without saving?
        </h3>
        <p className="mt-2 text-base text-neutral-600">
          Your entries won&rsquo;t be saved.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="flex min-h-[56px] w-full items-center justify-center rounded-xl bg-red-600 text-base font-semibold text-white hover:bg-red-700"
          >
            Leave
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-[56px] w-full items-center justify-center rounded-xl border border-neutral-300 text-base font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BudgetView — page-level client component
// ---------------------------------------------------------------------------

type Props = {
  householdId: string;
  categories: Category[];
  hasAnyActuals: boolean;
  lastMonthRecorded: boolean;
  defaultYear: number;
  defaultMonth: number;
};

type WizardStep =
  | { kind: "month" }
  | { kind: "category"; index: number }
  | { kind: "summary" };

export function BudgetView({
  householdId,
  categories,
  hasAnyActuals,
  lastMonthRecorded,
  defaultYear,
  defaultMonth,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [step, setStep] = useState<WizardStep>({ kind: "month" });
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [entries, setEntries] = useState<Record<string, EntryRecord>>({});
  const [isSaving, startSaveTransition] = useTransition();
  const [isLoadingActuals, startLoadTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasCategories = categories.length > 0;
  const lastMonthStr = monthLabel(defaultYear, defaultMonth);

  // Last 12 months, most recent first (excludes the current month)
  const availableMonths = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }, []);

  const loadActuals = useCallback(
    (year: number, month: number) => {
      startLoadTransition(async () => {
        const actuals = await getActualsForMonth(householdId, year, month);
        const next: Record<string, EntryRecord> = {};
        for (const a of actuals) {
          next[a.category_id] = {
            dollarAmount: Math.round(a.amount_cents / 100),
            skipped: false,
          };
        }
        setEntries(next);
      });
    },
    [householdId],
  );

  function openWizard() {
    setStep({ kind: "month" });
    setSelectedYear(defaultYear);
    setSelectedMonth(defaultMonth);
    setSaveError(null);
    setOpen(true);
    loadActuals(defaultYear, defaultMonth);
  }

  function closeWizard() {
    setOpen(false);
    setShowDiscard(false);
  }

  const tryClose = useCallback(() => {
    if (step.kind === "month") {
      closeWizard();
    } else {
      setShowDiscard(true);
    }
  }, [step.kind]);

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !showDiscard) tryClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, showDiscard, tryClose]);

  // Scroll lock
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, m] = e.target.value.split("-").map(Number);
    setSelectedYear(y);
    setSelectedMonth(m);
    setEntries({});
    loadActuals(y, m);
  }

  function handleMonthNext() {
    if (categories.length === 0) return;
    setStep({ kind: "category", index: 0 });
  }

  function handleCategoryNext(
    categoryId: string,
    dollarAmount: number | null,
    index: number,
  ) {
    if (dollarAmount !== null) {
      setEntries((prev) => ({
        ...prev,
        [categoryId]: { dollarAmount, skipped: false },
      }));
    }
    if (index < categories.length - 1) {
      setStep({ kind: "category", index: index + 1 });
    } else {
      setStep({ kind: "summary" });
    }
  }

  function handleSkip(categoryId: string, index: number) {
    setEntries((prev) => ({
      ...prev,
      [categoryId]: { dollarAmount: null, skipped: true },
    }));
    if (index < categories.length - 1) {
      setStep({ kind: "category", index: index + 1 });
    } else {
      setStep({ kind: "summary" });
    }
  }

  function handlePrev(index: number) {
    if (index === 0) {
      setStep({ kind: "month" });
    } else {
      setStep({ kind: "category", index: index - 1 });
    }
  }

  function handleSave() {
    const toSave = Object.entries(entries)
      .filter(([, e]) => !e.skipped && e.dollarAmount !== null)
      .map(([categoryId, e]) => ({
        categoryId,
        amountCents: (e.dollarAmount ?? 0) * 100,
      }));

    setSaveError(null);
    startSaveTransition(async () => {
      try {
        await saveCategoryActuals(
          householdId,
          selectedYear,
          selectedMonth,
          toSave,
        );
        closeWizard();
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Failed to save. Please try again.",
        );
      }
    });
  }

  const selectedMonthStr = monthLabel(selectedYear, selectedMonth);
  const catIndex = step.kind === "category" ? step.index : 0;
  const currentCategory =
    step.kind === "category" ? categories[step.index] : null;
  const currentEntry = currentCategory ? (entries[currentCategory.id] ?? null) : null;

  return (
    <>
      {/* Banner: categories exist but last month not yet recorded */}
      {hasCategories && !lastMonthRecorded && (
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-base font-medium text-blue-900">
            You haven&rsquo;t recorded {lastMonthStr} yet.
          </p>
          <button
            type="button"
            onClick={openWizard}
            className="mt-3 flex min-h-[44px] items-center justify-center rounded-lg bg-blue-700 px-5 text-base font-medium text-white hover:bg-blue-800"
          >
            Add now.
          </button>
        </div>
      )}

      {/* No categories */}
      {!hasCategories && (
        <p className="mt-6 text-neutral-600">
          No spending categories set up yet.{" "}
          <Link href="/settings" className="text-blue-700 underline">
            Add them in Settings →
          </Link>
        </p>
      )}

      {/* Empty state: categories exist but no actuals yet */}
      {hasCategories && !hasAnyActuals && (
        <p className="mt-6 text-neutral-600">
          No spending recorded yet. Tap{" "}
          <button
            type="button"
            onClick={openWizard}
            className="text-blue-700 underline"
          >
            &ldquo;Add {lastMonthStr}&rdquo;
          </button>{" "}
          to get started.
        </p>
      )}

      {/* Wizard */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={tryClose}
            aria-hidden="true"
          />

          {/* Panel — bottom sheet on mobile, centered dialog on ≥768 px */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Monthly budget entry"
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl md:bottom-auto md:left-1/2 md:top-1/2 md:right-auto md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Month selector step */}
            {step.kind === "month" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-2xl font-semibold">Select month</h2>
                  <button
                    type="button"
                    onClick={tryClose}
                    aria-label="Close"
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {categories.length === 0 ? (
                  <p className="text-neutral-600">
                    No spending categories set up yet.{" "}
                    <Link href="/settings" className="text-blue-700 underline">
                      Add them in Settings →
                    </Link>
                  </p>
                ) : (
                  <>
                    <div>
                      <label
                        htmlFor="month-select"
                        className="mb-2 block text-base font-medium"
                      >
                        Which month are you recording?
                      </label>
                      <select
                        id="month-select"
                        value={`${selectedYear}-${selectedMonth}`}
                        onChange={handleMonthChange}
                        className="min-h-[56px] w-full rounded-xl border border-neutral-300 bg-white px-4 text-base focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        {availableMonths.map(({ year, month }) => (
                          <option
                            key={`${year}-${month}`}
                            value={`${year}-${month}`}
                          >
                            {monthLabel(year, month)}
                          </option>
                        ))}
                      </select>
                      {isLoadingActuals && (
                        <p className="mt-2 text-sm text-neutral-500">
                          Loading existing entries…
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleMonthNext}
                      disabled={isLoadingActuals}
                      className="flex min-h-[56px] w-full items-center justify-center rounded-xl bg-blue-700 text-base font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                    >
                      Next
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Category steps */}
            {step.kind === "category" && currentCategory && (
              <CategoryStep
                key={`${catIndex}-${selectedYear}-${selectedMonth}`}
                category={currentCategory}
                index={catIndex}
                total={categories.length}
                month={selectedMonthStr}
                initialValue={
                  currentEntry && !currentEntry.skipped
                    ? currentEntry.dollarAmount
                    : null
                }
                onNext={(amount) =>
                  handleCategoryNext(currentCategory.id, amount, catIndex)
                }
                onSkip={() => handleSkip(currentCategory.id, catIndex)}
                onPrev={() => handlePrev(catIndex)}
                onClose={tryClose}
              />
            )}

            {/* Summary step */}
            {step.kind === "summary" && (
              <SummaryStep
                categories={categories}
                entries={entries}
                month={selectedMonthStr}
                onBack={() =>
                  setStep({ kind: "category", index: categories.length - 1 })
                }
                onSave={handleSave}
                onClose={tryClose}
                isSaving={isSaving}
                saveError={saveError}
              />
            )}
          </div>

          {/* Discard confirmation */}
          {showDiscard && (
            <DiscardConfirm
              onConfirm={closeWizard}
              onCancel={() => setShowDiscard(false)}
            />
          )}
        </>
      )}
    </>
  );
}
