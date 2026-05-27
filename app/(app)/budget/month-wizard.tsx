"use client";

import { useState } from "react";
import type { BudgetCategory, CategoryActual } from "./types";

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

function formatDollars(dollars: number): string {
  return `$${dollars.toLocaleString()}`;
}

function getSelectableMonths(): { year: number; month: number }[] {
  const now = new Date();
  const result: { year: number; month: number }[] = [];
  let y = now.getFullYear();
  let m = now.getMonth() - 1; // 0-indexed last month
  if (m < 0) {
    m = 11;
    y--;
  }
  for (let i = 0; i < 12; i++) {
    result.push({ year: y, month: m + 1 }); // month is 1-indexed
    m--;
    if (m < 0) {
      m = 11;
      y--;
    }
  }
  return result;
}

type Step = "month" | number | "summary";

// null = explicitly skipped; number = amount_cents (0 is valid)
type Entries = Record<string, number | null>;

interface MonthWizardProps {
  categories: BudgetCategory[];
  actuals: CategoryActual[];
  defaultMonth: { year: number; month: number };
  showBanner: boolean;
  bannerMonthLabel: string;
  saveAction: (
    year: number,
    month: number,
    entries: { categoryId: string; amountCents: number }[],
  ) => Promise<{ error?: string }>;
}

export function MonthWizard({
  categories,
  actuals,
  defaultMonth,
  showBanner,
  bannerMonthLabel,
  saveAction,
}: MonthWizardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const [step, setStep] = useState<Step>("month");
  const [selectedYear, setSelectedYear] = useState(defaultMonth.year);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth.month);
  const [entries, setEntries] = useState<Entries>({});
  const [currentInput, setCurrentInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectableMonths = getSelectableMonths();
  const hasEnteredAnything = Object.keys(entries).length > 0;
  const selectedMonthLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  function openWizard() {
    setStep("month");
    setSelectedYear(defaultMonth.year);
    setSelectedMonth(defaultMonth.month);
    setEntries({});
    setCurrentInput("");
    setInputFocused(false);
    setSaveError(null);
    setIsOpen(true);
  }

  function requestClose() {
    if (step !== "month" || hasEnteredAnything) {
      setShowDismissConfirm(true);
    } else {
      setIsOpen(false);
    }
  }

  function confirmDismiss() {
    setIsOpen(false);
    setShowDismissConfirm(false);
    setStep("month");
    setEntries({});
    setCurrentInput("");
  }

  function goToCategory(idx: number, withEntries: Entries) {
    const cat = categories[idx];
    if (!cat) return;
    const val = withEntries[cat.id];
    setCurrentInput(val != null ? String(Math.round(val / 100)) : "");
    setInputFocused(false);
    setStep(idx);
  }

  function handleMonthNext() {
    const newEntries: Entries = {};
    for (const a of actuals) {
      if (a.year === selectedYear && a.month === selectedMonth) {
        newEntries[a.category_id] = a.amount_cents;
      }
    }
    setEntries(newEntries);
    if (categories.length === 0) {
      setStep("summary");
    } else {
      goToCategory(0, newEntries);
    }
  }

  function commitCurrentStep(categoryId: string, newEntries: Entries) {
    const idx = step as number;
    const nextIdx = idx + 1;
    if (nextIdx < categories.length) {
      goToCategory(nextIdx, newEntries);
    } else {
      setStep("summary");
    }
  }

  function handleCategoryNext(categoryId: string) {
    const raw = currentInput.trim().replace(/[^0-9]/g, "");
    const amountCents = raw === "" ? null : parseInt(raw, 10) * 100;
    const newEntries = { ...entries, [categoryId]: amountCents };
    setEntries(newEntries);
    commitCurrentStep(categoryId, newEntries);
  }

  function handleCategorySkip(categoryId: string) {
    const newEntries = { ...entries, [categoryId]: null };
    setEntries(newEntries);
    commitCurrentStep(categoryId, newEntries);
  }

  function handlePrevious() {
    if (step === "summary") {
      goToCategory(categories.length - 1, entries);
      return;
    }
    const idx = step as number;
    if (idx === 0) {
      setStep("month");
    } else {
      goToCategory(idx - 1, entries);
    }
  }

  async function handleSave() {
    const toSave = Object.entries(entries)
      .filter(([, v]) => v !== null)
      .map(([categoryId, amountCents]) => ({
        categoryId,
        amountCents: amountCents!,
      }));

    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await saveAction(selectedYear, selectedMonth, toSave);
      if (result?.error) {
        setSaveError(result.error);
        return;
      }
      confirmDismiss();
    } finally {
      setIsSaving(false);
    }
  }

  const catIdx = typeof step === "number" ? step : -1;
  const currentCat = catIdx >= 0 ? categories[catIdx] : null;

  const inputDisplayValue =
    inputFocused || !currentInput
      ? currentInput
      : Number(currentInput).toLocaleString();

  return (
    <>
      {/* Banner */}
      {showBanner && (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-base font-medium text-blue-900">
            You haven&rsquo;t recorded {bannerMonthLabel} yet.
          </p>
          <button
            onClick={openWizard}
            className="shrink-0 rounded-lg bg-blue-700 px-5 py-3 text-base font-semibold text-white"
          >
            Add now
          </button>
        </div>
      )}

      {/* Wizard overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60 md:justify-center"
          onClick={requestClose}
        >
          <div
            className="flex w-full flex-col overflow-hidden rounded-t-2xl bg-white md:mx-auto md:max-w-md md:rounded-2xl"
            style={{ maxHeight: "90dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pb-1 pt-3 md:hidden">
              <div className="h-1 w-12 rounded-full bg-neutral-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
              <h2 className="text-xl font-semibold">
                {step === "month"
                  ? "Select month"
                  : step === "summary"
                    ? "Review & save"
                    : currentCat?.name ?? ""}
              </h2>
              <button
                onClick={requestClose}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {/* ── Month step ── */}
              {step === "month" && (
                <div className="space-y-4">
                  <label
                    htmlFor="month-select"
                    className="block text-base font-medium text-neutral-700"
                  >
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
                    className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-base"
                    style={{ minHeight: "56px" }}
                  >
                    {selectableMonths.map(({ year, month }) => (
                      <option
                        key={`${year}-${month}`}
                        value={`${year}-${month}`}
                      >
                        {MONTH_NAMES[month - 1]} {year}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Category step ── */}
              {currentCat && (
                <div className="space-y-5">
                  <p className="text-sm text-neutral-500">
                    Step {catIdx + 1} of {categories.length}
                  </p>

                  {currentCat.monthly_budget_cents != null && (
                    <p className="text-sm text-neutral-500">
                      Budget:{" "}
                      {formatDollars(
                        Math.round(currentCat.monthly_budget_cents / 100),
                      )}
                      /month
                    </p>
                  )}

                  <label
                    htmlFor="amount-input"
                    className="block text-lg font-medium text-neutral-800"
                  >
                    About how much did you spend in {selectedMonthLabel}?
                  </label>

                  <div
                    className="flex items-stretch overflow-hidden rounded-lg border border-neutral-300"
                    style={{ minHeight: "56px" }}
                  >
                    <span className="flex items-center border-r border-neutral-300 bg-neutral-50 px-4 text-lg text-neutral-500">
                      $
                    </span>
                    <input
                      id="amount-input"
                      key={catIdx} // remount when category changes to clear browser autofill
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={inputDisplayValue}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        if (val && Number(val) > 999999) return;
                        setCurrentInput(val);
                      }}
                      autoFocus
                      autoComplete="off"
                      className="flex-1 bg-white px-4 text-lg outline-none"
                    />
                  </div>
                </div>
              )}

              {/* ── No categories empty state ── */}
              {step === "month" ||
                (step === "summary" && categories.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-base text-neutral-600">
                      No spending categories set up yet.{" "}
                      <a
                        href="/settings"
                        className="text-blue-700 underline"
                      >
                        Add them in Settings →
                      </a>
                    </p>
                  </div>
                ))}

              {/* ── Summary step ── */}
              {step === "summary" && categories.length > 0 && (
                <div className="space-y-4">
                  <p className="text-base text-neutral-600">
                    Review your entries for {selectedMonthLabel}.
                  </p>
                  <table className="w-full text-base">
                    <tbody>
                      {categories.map((cat) => {
                        const val = entries[cat.id];
                        const display =
                          val == null
                            ? "Skipped"
                            : formatDollars(Math.round(val / 100));
                        return (
                          <tr
                            key={cat.id}
                            className="border-b border-neutral-100 last:border-0"
                          >
                            <td className="py-3 pr-4 text-neutral-800">
                              {cat.name}
                            </td>
                            <td className="py-3 text-right font-medium text-neutral-800">
                              {display}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {saveError && (
                    <p className="text-sm text-red-700">{saveError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="space-y-3 border-t border-neutral-100 px-6 py-4">
              {step === "month" && (
                <button
                  onClick={handleMonthNext}
                  className="w-full rounded-lg bg-blue-700 text-base font-semibold text-white"
                  style={{ minHeight: "56px" }}
                >
                  Next
                </button>
              )}

              {currentCat && (
                <>
                  <div className="flex gap-3">
                    <button
                      onClick={handlePrevious}
                      className="flex-1 rounded-lg border border-neutral-300 text-base font-semibold text-neutral-700"
                      style={{ minHeight: "56px" }}
                    >
                      {catIdx === 0 ? "Back" : "Previous"}
                    </button>
                    <button
                      onClick={() => handleCategoryNext(currentCat.id)}
                      className="flex-1 rounded-lg bg-blue-700 text-base font-semibold text-white"
                      style={{ minHeight: "56px" }}
                    >
                      {catIdx === categories.length - 1 ? "Review" : "Next"}
                    </button>
                  </div>
                  <button
                    onClick={() => handleCategorySkip(currentCat.id)}
                    className="w-full py-3 text-base text-neutral-500"
                    style={{ minHeight: "44px" }}
                  >
                    Skip
                  </button>
                </>
              )}

              {step === "summary" && (
                <div className="flex gap-3">
                  <button
                    onClick={handlePrevious}
                    className="flex-1 rounded-lg border border-neutral-300 text-base font-semibold text-neutral-700"
                    style={{ minHeight: "56px" }}
                  >
                    Go back
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 rounded-lg bg-blue-700 text-base font-semibold text-white disabled:opacity-50"
                    style={{ minHeight: "56px" }}
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dismiss confirmation */}
      {showDismissConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="mb-2 text-xl font-semibold text-neutral-900">
              Leave without saving?
            </h3>
            <p className="mb-6 text-base text-neutral-600">
              Your entries won&rsquo;t be saved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDismissConfirm(false)}
                className="flex-1 rounded-lg border border-neutral-300 text-base font-semibold text-neutral-700"
                style={{ minHeight: "56px" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDismiss}
                className="flex-1 rounded-lg bg-neutral-900 text-base font-semibold text-white"
                style={{ minHeight: "56px" }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
