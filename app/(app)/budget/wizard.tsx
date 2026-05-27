"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveMonthlyActuals } from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Category = {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
};

export type Actual = {
  category_id: string;
  year: number;
  month: number;
  amount_cents: number;
};

// null  = explicitly skipped
// number = dollar amount (0 is a valid explicit entry)
type EntryValue = number | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAvailableMonths(): { year: number; month: number; label: string }[] {
  const today = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (i + 1), 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleString("en-US", { month: "long", year: "numeric" }),
    };
  });
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDollars(dollars: number): string {
  return "$" + new Intl.NumberFormat("en-US").format(dollars);
}

function parseDollars(raw: string): number | null {
  const stripped = raw.replace(/[$,\s]/g, "");
  if (stripped === "") return null;
  const n = parseInt(stripped, 10);
  return isNaN(n) ? null : Math.min(Math.max(0, n), 999999);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close wizard"
      className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[56px] w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-lg font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[56px] w-full items-center justify-center rounded-xl border border-neutral-300 px-6 text-lg font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center justify-center px-6 text-lg font-medium text-neutral-500 hover:text-neutral-900 underline underline-offset-2"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

const MONTH_PICKER_STEP = 0;
// steps 1..N are category steps
// step N+1 is the summary

type WizardProps = {
  householdId: string;
  categories: Category[];
  actuals: Actual[];
  defaultYear: number;
  defaultMonth: number;
};

export function BudgetWizard({
  householdId,
  categories,
  actuals,
  defaultYear,
  defaultMonth,
}: WizardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [step, setStep] = useState(MONTH_PICKER_STEP);

  // entries: category_id → (number = dollars, null = skipped, absent = not visited)
  const [entries, setEntries] = useState<Record<string, EntryValue>>({});

  // Raw input string for the current category step
  const [inputRaw, setInputRaw] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const availableMonths = getAvailableMonths();

  const N = categories.length;
  const summaryStep = N + 1;
  const isDirty = step > MONTH_PICKER_STEP;

  // Focus first focusable element inside dialog when it opens
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  // When step changes to a category step, scroll to top and seed the input
  useEffect(() => {
    if (!isOpen || step < 1 || step > N) return;
    dialogRef.current?.scrollTo({ top: 0 });
    const cat = categories[step - 1];
    const existing = entries[cat.id];
    if (existing !== null && existing !== undefined) {
      setInputRaw(String(existing));
    } else {
      setInputRaw("");
    }
    setIsInputFocused(false);
    // Autofocus the input after render
    setTimeout(() => inputRef.current?.focus(), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isOpen]);

  // -------------------------------------------------------------------------
  // Entry pre-population from existing actuals
  // -------------------------------------------------------------------------

  function buildEntriesFromActuals(
    y: number,
    m: number,
  ): Record<string, EntryValue> {
    const init: Record<string, EntryValue> = {};
    for (const cat of categories) {
      const existing = actuals.find(
        (a) => a.category_id === cat.id && a.year === y && a.month === m,
      );
      if (existing !== undefined) {
        init[cat.id] = Math.round(existing.amount_cents / 100);
      }
    }
    return init;
  }

  // -------------------------------------------------------------------------
  // Open / close
  // -------------------------------------------------------------------------

  function open() {
    setSelectedYear(defaultYear);
    setSelectedMonth(defaultMonth);
    setStep(MONTH_PICKER_STEP);
    setEntries({});
    setInputRaw("");
    setSaveError(null);
    setIsOpen(true);
  }

  function requestClose() {
    if (isDirty) {
      setShowConfirmClose(true);
    } else {
      forceClose();
    }
  }

  function forceClose() {
    setIsOpen(false);
    setShowConfirmClose(false);
    setStep(MONTH_PICKER_STEP);
    setEntries({});
    setInputRaw("");
    setSaveError(null);
    triggerRef.current?.focus();
  }

  // -------------------------------------------------------------------------
  // Navigation helpers
  // -------------------------------------------------------------------------

  function currentRawToDollars(): number | null {
    return parseDollars(inputRaw);
  }

  function advanceToStep(nextStep: number, newEntries: Record<string, EntryValue>) {
    setEntries(newEntries);
    setStep(nextStep);
    if (nextStep >= 1 && nextStep <= N) {
      const nextCat = categories[nextStep - 1];
      const v = newEntries[nextCat.id];
      setInputRaw(v !== null && v !== undefined ? String(v) : "");
    }
    setIsInputFocused(false);
  }

  function handleMonthContinue() {
    const init = buildEntriesFromActuals(selectedYear, selectedMonth);
    advanceToStep(1, init);
  }

  function handleNext() {
    const cat = categories[step - 1];
    const dollars = currentRawToDollars();
    const newEntries = {
      ...entries,
      ...(dollars !== null ? { [cat.id]: dollars } : {}),
    };
    advanceToStep(step + 1, newEntries);
  }

  function handleSkip() {
    const cat = categories[step - 1];
    const newEntries = { ...entries, [cat.id]: null };
    advanceToStep(step + 1, newEntries);
  }

  function handlePrevious() {
    if (step === 1) {
      // Save current input then go back to month picker
      const cat = categories[0];
      const dollars = currentRawToDollars();
      setEntries({
        ...entries,
        ...(dollars !== null ? { [cat.id]: dollars } : {}),
      });
      setStep(MONTH_PICKER_STEP);
      return;
    }
    // Save current input then move back one step
    const cat = categories[step - 1];
    const dollars = currentRawToDollars();
    const newEntries = {
      ...entries,
      ...(dollars !== null ? { [cat.id]: dollars } : {}),
    };
    advanceToStep(step - 1, newEntries);
  }

  function handleGoBackFromSummary() {
    advanceToStep(N, entries);
  }

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  function handleSave() {
    const entriesToSave = categories
      .map((cat) => ({ categoryId: cat.id, value: entries[cat.id] }))
      .filter(({ value }) => value !== null && value !== undefined)
      .map(({ categoryId, value }) => ({
        categoryId,
        amountCents: (value as number) * 100,
      }));

    setSaveError(null);
    startTransition(async () => {
      const result = await saveMonthlyActuals({
        householdId,
        year: selectedYear,
        month: selectedMonth,
        entries: entriesToSave,
      });
      if (result?.error) {
        setSaveError(result.error);
      } else {
        forceClose();
      }
    });
  }

  // -------------------------------------------------------------------------
  // Input display value
  // -------------------------------------------------------------------------

  const inputDisplayValue = (() => {
    if (isInputFocused) return inputRaw;
    const n = parseDollars(inputRaw);
    if (n === null) return "";
    return formatDollars(n);
  })();

  // -------------------------------------------------------------------------
  // Keyboard handler for dialog (Escape = requestClose)
  // -------------------------------------------------------------------------

  function handleDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (showConfirmClose) {
        setShowConfirmClose(false);
      } else {
        requestClose();
      }
    }
  }

  const label = monthLabel(selectedYear, selectedMonth);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        className="inline-flex min-h-[56px] items-center rounded-xl bg-blue-600 px-6 text-lg font-semibold text-white hover:bg-blue-700"
      >
        Add now
      </button>

      {isOpen && (
        // Full-screen overlay: items-end on mobile (sheet), items-center on desktop (dialog)
        <div
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
          onKeyDown={handleDialogKeyDown}
        >
          {/* Backdrop */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/50"
            onClick={requestClose}
          />

          {/* Modal panel */}
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wizard-title"
            tabIndex={-1}
            className="relative z-10 flex w-full max-h-[92vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl focus:outline-none md:max-w-lg md:rounded-2xl md:mx-4"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h2 id="wizard-title" className="text-xl font-semibold">
                {step === MONTH_PICKER_STEP && "Record spending"}
                {step >= 1 && step <= N && categories[step - 1].name}
                {step === summaryStep && `Review — ${label}`}
              </h2>
              <CloseButton onClick={requestClose} />
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-6">
              {/* ---- Month picker ---- */}
              {step === MONTH_PICKER_STEP && (
                <div className="space-y-6">
                  <p className="text-base text-neutral-600">
                    Which month would you like to record?
                  </p>
                  <div>
                    <label
                      htmlFor="month-select"
                      className="mb-2 block text-lg font-medium"
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
                      className="w-full rounded-xl border border-neutral-300 px-4 py-4 text-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      {availableMonths.map((opt) => (
                        <option
                          key={`${opt.year}-${opt.month}`}
                          value={`${opt.year}-${opt.month}`}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* ---- Category step ---- */}
              {step >= 1 && step <= N && (() => {
                const cat = categories[step - 1];
                return (
                  <div className="space-y-6">
                    {/* Progress indicator */}
                    <p
                      aria-label={`Step ${step} of ${N}`}
                      className="text-base font-medium text-neutral-500"
                    >
                      Step {step} of {N}
                    </p>

                    {/* Progress bar */}
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
                      aria-hidden="true"
                    >
                      <div
                        className="h-2 rounded-full bg-blue-600 transition-all"
                        style={{ width: `${(step / N) * 100}%` }}
                      />
                    </div>

                    {/* Budget hint */}
                    {cat.monthly_budget_cents !== null && (
                      <p className="text-base text-neutral-500">
                        Budget: {formatDollars(Math.round(cat.monthly_budget_cents / 100))}/month
                      </p>
                    )}

                    {/* Amount input */}
                    <div>
                      <label
                        htmlFor="amount-input"
                        className="mb-2 block text-lg font-medium"
                      >
                        About how much did you spend in{" "}
                        {monthLabel(selectedYear, selectedMonth)}?
                      </label>
                      <div className="relative flex items-center rounded-xl border border-neutral-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
                        <span
                          aria-hidden="true"
                          className="pointer-events-none pl-4 text-xl font-medium text-neutral-500"
                        >
                          $
                        </span>
                        <input
                          ref={inputRef}
                          id="amount-input"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="0"
                          autoComplete="off"
                          value={inputDisplayValue}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[$,\s]/g, "").replace(/\D/g, "");
                            const n = parseInt(raw, 10);
                            if (raw !== "" && !isNaN(n) && n > 999999) return;
                            setInputRaw(raw);
                          }}
                          onFocus={() => {
                            setIsInputFocused(true);
                            // Strip formatting on focus
                            const n = parseDollars(inputRaw);
                            setInputRaw(n !== null ? String(n) : "");
                          }}
                          onBlur={() => setIsInputFocused(false)}
                          className="min-h-[56px] w-full rounded-xl bg-transparent py-4 pl-2 pr-4 text-xl focus:outline-none"
                        />
                      </div>
                      <p className="mt-2 text-sm text-neutral-500">
                        Whole dollars only. Min $0, max $999,999.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* ---- Summary step ---- */}
              {step === summaryStep && (
                <div className="space-y-6">
                  <p className="text-base text-neutral-600">
                    Review your entries for {label}. Tap Save to record them.
                  </p>

                  {saveError && (
                    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-700">
                      {saveError}
                    </p>
                  )}

                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="pb-3 text-base font-semibold text-neutral-700">
                          Category
                        </th>
                        <th className="pb-3 text-right text-base font-semibold text-neutral-700">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => {
                        const v = entries[cat.id];
                        const isSkipped = v === null || v === undefined;
                        return (
                          <tr
                            key={cat.id}
                            className="border-b border-neutral-100 last:border-0"
                          >
                            <td className="py-3 text-lg">{cat.name}</td>
                            <td
                              className={`py-3 text-right text-lg ${
                                isSkipped ? "text-neutral-400 italic" : "font-medium"
                              }`}
                            >
                              {isSkipped ? "Skipped" : formatDollars(v as number)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-neutral-100 px-5 py-4">
              {step === MONTH_PICKER_STEP && (
                <PrimaryButton onClick={handleMonthContinue}>
                  Continue
                </PrimaryButton>
              )}

              {step >= 1 && step <= N && (
                <div className="flex flex-col gap-3">
                  <PrimaryButton onClick={handleNext}>
                    {step === N ? "Review" : "Next"}
                  </PrimaryButton>
                  <div className="flex gap-3">
                    <SecondaryButton onClick={handlePrevious}>
                      Previous
                    </SecondaryButton>
                    <GhostButton onClick={handleSkip}>Skip</GhostButton>
                  </div>
                </div>
              )}

              {step === summaryStep && (
                <div className="flex flex-col gap-3">
                  <PrimaryButton onClick={handleSave} disabled={isPending}>
                    {isPending ? "Saving…" : "Save"}
                  </PrimaryButton>
                  <SecondaryButton
                    onClick={handleGoBackFromSummary}
                    disabled={isPending}
                  >
                    Go back
                  </SecondaryButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- Confirm-close modal ---- */}
      {showConfirmClose && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-close-title"
          aria-describedby="confirm-close-desc"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowConfirmClose(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3
              id="confirm-close-title"
              className="text-xl font-semibold"
            >
              Leave without saving?
            </h3>
            <p
              id="confirm-close-desc"
              className="mt-2 text-base text-neutral-600"
            >
              Your entries won&rsquo;t be saved.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <PrimaryButton onClick={forceClose}>Leave</PrimaryButton>
              <SecondaryButton onClick={() => setShowConfirmClose(false)}>
                Cancel
              </SecondaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
