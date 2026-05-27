"use client";

import { useCallback, useState, useTransition } from "react";
import { saveActuals, type ActualEntry } from "./actions";

type Category = {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
};

type ExistingActual = {
  category_id: string;
  amount_cents: number;
};

type Props = {
  householdId: string;
  categories: Category[];
  defaultYear: number;
  defaultMonth: number;
  existingActuals: ExistingActual[];
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDollars(cents: number): string {
  return "$" + Math.round(cents / 100).toLocaleString("en-US");
}

function parseInputToCents(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits === "") return null;
  const n = parseInt(digits, 10);
  if (isNaN(n) || n < 0 || n > 999999) return null;
  return n * 100;
}

function formatInputDisplay(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits === "") return "";
  const n = parseInt(digits, 10);
  if (isNaN(n)) return "";
  return "$" + n.toLocaleString("en-US");
}

type Step =
  | { kind: "month" }
  | { kind: "category"; index: number }
  | { kind: "summary" };

type EntryMap = Record<string, number | null>; // categoryId → cents | null (skipped)

const now = new Date();

function getSelectableMonths(): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  // Up to 12 months in the past (not including current month)
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return months;
}

export function EntryWizard({
  householdId,
  categories,
  defaultYear,
  defaultMonth,
  existingActuals,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "month" });
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [entries, setEntries] = useState<EntryMap>({});
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectableMonths = getSelectableMonths();

  const openWizard = () => {
    setStep({ kind: "month" });
    setEntries({});
    setRawInputs({});
    setSaveError(null);
    setOpen(true);
  };

  const hasUnsavedWork = Object.keys(entries).length > 0;

  const requestClose = useCallback(() => {
    if (hasUnsavedWork) {
      setConfirmClose(true);
    } else {
      setOpen(false);
    }
  }, [hasUnsavedWork]);

  const forceClose = () => {
    setConfirmClose(false);
    setOpen(false);
  };

  const dismissConfirm = () => setConfirmClose(false);

  // When month changes, pre-populate entries from existing actuals for that month
  const applyMonth = (year: number, month: number) => {
    const prefill: EntryMap = {};
    const prefillRaw: Record<string, string> = {};
    for (const actual of existingActuals) {
      prefill[actual.category_id] = actual.amount_cents;
      prefillRaw[actual.category_id] = formatInputDisplay(
        String(Math.round(actual.amount_cents / 100)),
      );
    }
    setSelectedYear(year);
    setSelectedMonth(month);
    setEntries(prefill);
    setRawInputs(prefillRaw);
  };

  const goToCategory = (index: number) => setStep({ kind: "category", index });

  const currentCategoryIndex =
    step.kind === "category" ? step.index : 0;

  const handleNext = (index: number) => {
    if (index + 1 < categories.length) {
      setStep({ kind: "category", index: index + 1 });
    } else {
      setStep({ kind: "summary" });
    }
  };

  const handlePrev = (index: number) => {
    if (index === 0) {
      setStep({ kind: "month" });
    } else {
      setStep({ kind: "category", index: index - 1 });
    }
  };

  const handleSkip = (index: number) => {
    // Remove entry for this category (skip = no row written)
    const cat = categories[index];
    setEntries((prev) => {
      const next = { ...prev };
      delete next[cat.id];
      return next;
    });
    setRawInputs((prev) => {
      const next = { ...prev };
      delete next[cat.id];
      return next;
    });
    handleNext(index);
  };

  const handleAmountBlur = (catId: string, raw: string) => {
    const cents = parseInputToCents(raw);
    if (cents !== null) {
      setRawInputs((prev) => ({ ...prev, [catId]: formatInputDisplay(raw) }));
    }
  };

  const handleAmountChange = (catId: string, value: string) => {
    setRawInputs((prev) => ({ ...prev, [catId]: value }));
    const cents = parseInputToCents(value);
    if (cents !== null) {
      setEntries((prev) => ({ ...prev, [catId]: cents }));
    } else if (value === "" || value === "$") {
      setEntries((prev) => ({ ...prev, [catId]: null }));
    }
  };

  const handleSave = () => {
    setSaveError(null);
    const toSave: ActualEntry[] = [];
    for (const [catId, cents] of Object.entries(entries)) {
      if (cents !== null) {
        toSave.push({
          categoryId: catId,
          year: selectedYear,
          month: selectedMonth,
          amountCents: cents,
        });
      }
    }
    startTransition(async () => {
      const result = await saveActuals(householdId, toSave);
      if (result.error) {
        setSaveError(result.error);
      } else {
        setOpen(false);
      }
    });
  };

  const overlayClass =
    "fixed inset-0 z-40 bg-black/50 flex items-end md:items-center justify-center";
  const panelClass =
    "relative z-50 w-full bg-white md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90dvh]";

  return (
    <>
      <button
        type="button"
        onClick={openWizard}
        className="rounded-lg bg-blue-700 px-6 py-3 text-base font-semibold text-white hover:bg-blue-800 min-h-[56px]"
      >
        Add now
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className={overlayClass}
            onClick={requestClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Monthly spending entry"
            className={panelClass}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <h2 className="text-xl font-semibold">Record spending</h2>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                className="text-neutral-500 hover:text-neutral-800 min-h-[44px] min-w-[44px] flex items-center justify-center text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {step.kind === "month" && (
                <MonthStep
                  selectableMonths={selectableMonths}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  onSelect={applyMonth}
                />
              )}
              {step.kind === "category" && (
                <CategoryStep
                  category={categories[step.index]}
                  index={step.index}
                  total={categories.length}
                  monthLabel={`${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
                  rawValue={rawInputs[categories[step.index].id] ?? ""}
                  onChange={(v) => handleAmountChange(categories[step.index].id, v)}
                  onBlur={(v) => handleAmountBlur(categories[step.index].id, v)}
                />
              )}
              {step.kind === "summary" && (
                <SummaryStep
                  categories={categories}
                  entries={entries}
                  monthLabel={`${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
                />
              )}
              {saveError && (
                <p className="mt-4 text-red-700 text-base">{saveError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-neutral-200 px-6 py-4">
              {step.kind === "month" && (
                <button
                  type="button"
                  onClick={() => setStep({ kind: "category", index: 0 })}
                  className="w-full rounded-lg bg-blue-700 py-4 text-base font-semibold text-white hover:bg-blue-800 min-h-[56px]"
                >
                  Next
                </button>
              )}
              {step.kind === "category" && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const catId = categories[currentCategoryIndex].id;
                      const raw = rawInputs[catId] ?? "";
                      const cents = parseInputToCents(raw);
                      if (cents !== null) {
                        setEntries((prev) => ({ ...prev, [catId]: cents }));
                      }
                      handleNext(currentCategoryIndex);
                    }}
                    className="w-full rounded-lg bg-blue-700 py-4 text-base font-semibold text-white hover:bg-blue-800 min-h-[56px]"
                  >
                    Next
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handlePrev(currentCategoryIndex)}
                      className="flex-1 rounded-lg border border-neutral-300 py-4 text-base font-medium text-neutral-700 hover:bg-neutral-50 min-h-[56px]"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSkip(currentCategoryIndex)}
                      className="flex-1 rounded-lg border border-neutral-300 py-4 text-base font-medium text-neutral-700 hover:bg-neutral-50 min-h-[56px]"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
              {step.kind === "summary" && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending}
                    className="w-full rounded-lg bg-blue-700 py-4 text-base font-semibold text-white hover:bg-blue-800 disabled:opacity-50 min-h-[56px]"
                  >
                    {isPending ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep({ kind: "category", index: categories.length - 1 })}
                    className="w-full rounded-lg border border-neutral-300 py-4 text-base font-medium text-neutral-700 hover:bg-neutral-50 min-h-[56px]"
                  >
                    Go back
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Confirm-close modal */}
          {confirmClose && (
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-close-title"
              style={{ position: "fixed", inset: 0, zIndex: 60 }}
              className="flex items-center justify-center bg-black/60 px-4"
            >
              <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
                <h3 id="confirm-close-title" className="text-xl font-semibold">
                  Leave without saving?
                </h3>
                <p className="mt-3 text-base text-neutral-600">
                  Your entries won&apos;t be saved.
                </p>
                <div className="mt-8 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={forceClose}
                    className="w-full rounded-lg bg-red-600 py-4 text-base font-semibold text-white hover:bg-red-700 min-h-[56px]"
                  >
                    Leave without saving
                  </button>
                  <button
                    type="button"
                    onClick={dismissConfirm}
                    className="w-full rounded-lg border border-neutral-300 py-4 text-base font-medium text-neutral-700 hover:bg-neutral-50 min-h-[56px]"
                  >
                    Keep editing
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MonthStep({
  selectableMonths,
  selectedYear,
  selectedMonth,
  onSelect,
}: {
  selectableMonths: { year: number; month: number }[];
  selectedYear: number;
  selectedMonth: number;
  onSelect: (year: number, month: number) => void;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold">Which month are you recording?</h3>
      <ul className="mt-4 space-y-2">
        {selectableMonths.map(({ year, month }) => {
          const selected = year === selectedYear && month === selectedMonth;
          return (
            <li key={`${year}-${month}`}>
              <button
                type="button"
                onClick={() => onSelect(year, month)}
                className={`w-full rounded-lg border px-4 py-4 text-left text-base font-medium min-h-[56px] ${
                  selected
                    ? "border-blue-700 bg-blue-50 text-blue-700"
                    : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {MONTH_NAMES[month - 1]} {year}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CategoryStep({
  category,
  index,
  total,
  monthLabel,
  rawValue,
  onChange,
  onBlur,
}: {
  category: Category;
  index: number;
  total: number;
  monthLabel: string;
  rawValue: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-500 mb-1">
        Step {index + 1} of {total}
      </p>
      <div className="w-full bg-neutral-200 rounded-full h-2 mb-6">
        <div
          className="bg-blue-700 h-2 rounded-full transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>
      <h3 className="text-2xl font-semibold">{category.name}</h3>
      {category.monthly_budget_cents !== null && (
        <p className="mt-1 text-base text-neutral-500">
          Budget: {formatDollars(category.monthly_budget_cents)}/month
        </p>
      )}
      <label
        htmlFor={`amount-${category.id}`}
        className="mt-6 block text-lg font-medium text-neutral-800"
      >
        About how much did you spend in {monthLabel}?
      </label>
      <div className="mt-3 flex items-center rounded-lg border border-neutral-300 focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-200">
        <input
          id={`amount-${category.id}`}
          type="text"
          inputMode="numeric"
          placeholder="$0"
          value={rawValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          className="w-full rounded-lg bg-transparent px-4 text-xl font-semibold text-neutral-900 outline-none placeholder:text-neutral-400"
          style={{ height: "56px" }}
          autoFocus
        />
      </div>
    </div>
  );
}

function SummaryStep({
  categories,
  entries,
  monthLabel,
}: {
  categories: Category[];
  entries: EntryMap;
  monthLabel: string;
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold">Review — {monthLabel}</h3>
      <p className="mt-1 text-base text-neutral-600">Confirm before saving.</p>
      <table className="mt-6 w-full text-base">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="pb-2 text-left font-semibold text-neutral-700">Category</th>
            <th className="pb-2 text-right font-semibold text-neutral-700">Amount</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => {
            const cents = entries[cat.id];
            return (
              <tr key={cat.id} className="border-b border-neutral-100">
                <td className="py-3 text-neutral-800">{cat.name}</td>
                <td className="py-3 text-right text-neutral-800">
                  {cents === undefined ? (
                    <span className="text-neutral-400 italic">Skipped</span>
                  ) : cents === null ? (
                    <span className="text-neutral-400 italic">Skipped</span>
                  ) : (
                    formatDollars(cents)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
