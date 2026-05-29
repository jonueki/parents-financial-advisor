"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { formatDollars, formatInputDisplay, parseDollarInput } from "@/lib/money";
import { monthLabel } from "@/lib/dates";
import { saveCategoryActuals } from "./actions";

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

type StepValues = Record<string, string>; // categoryId -> raw input string | "skip"

const SKIP = "__skip__";

// Build initial StepValues by prefilling from existing actuals. Used as a
// `useState` initializer so it runs once on mount instead of in an effect
// that would clobber in-progress edits on every prop reference change.
function buildInitialValues(existing: ExistingActual[]): StepValues {
  const prefilled: StepValues = {};
  for (const actual of existing) {
    const dollars = Math.round(actual.amount_cents / 100);
    prefilled[actual.category_id] = "$" + dollars.toLocaleString("en-US");
  }
  return prefilled;
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

  // The wizard is fixed to `defaultYear` / `defaultMonth` (which the page
  // computes as last month per PLAN.md's "Update last month" framing).
  // Editing a different month is a separate feature.

  // step: 1..n = categories, n+1 = summary
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<StepValues>(() =>
    buildInitialValues(existingActuals),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalCategorySteps = categories.length;
  const summaryStep = totalCategorySteps + 1;

  const openWizard = () => {
    setStep(1);
    setSaveError(null);
    setOpen(true);
  };

  const tryClose = () => {
    // If user has entered anything, confirm before closing
    const hasEntries = Object.values(values).some((v) => v !== "" && v !== SKIP);
    if (hasEntries) {
      setConfirmClose(true);
    } else {
      closeWizard();
    }
  };

  const closeWizard = () => {
    setOpen(false);
    setConfirmClose(false);
    setStep(1);
    setValues(buildInitialValues(existingActuals));
    setSaveError(null);
  };

  const categoryForStep = (s: number): Category | null => {
    return categories[s - 1] ?? null;
  };

  const handleSave = () => {
    const entries: { categoryId: string; amountCents: number }[] = [];
    for (const cat of categories) {
      const raw = values[cat.id];
      if (!raw || raw === SKIP) continue;
      const cents = parseDollarInput(raw);
      if (cents !== null) {
        entries.push({ categoryId: cat.id, amountCents: cents });
      }
    }
    startTransition(async () => {
      const result = await saveCategoryActuals(
        householdId,
        defaultYear,
        defaultMonth,
        entries,
      );
      if (result.ok) {
        closeWizard();
      } else {
        setSaveError(result.message);
      }
    });
  };

  // Trap focus inside the overlay when open
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      const firstFocusable = overlayRef.current?.querySelector<HTMLElement>(
        "button, input, select, a[href]",
      );
      firstFocusable?.focus();
    }
  }, [open, step]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) tryClose();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, values, step],
  );
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const label = monthLabel(defaultYear, defaultMonth);

  return (
    <>
      <button
        onClick={openWizard}
        className="rounded-lg bg-blue-700 px-6 py-3 text-base font-semibold text-white hover:bg-blue-800 active:bg-blue-900"
        style={{ minHeight: 56 }}
      >
        Add now
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          aria-hidden="true"
          onClick={tryClose}
        />
      )}

      {/* Panel: bottom sheet on mobile, centered dialog on ≥768px */}
      {open && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="Monthly spending entry"
          className={[
            "fixed z-50 bg-white shadow-xl",
            "inset-x-0 bottom-0 rounded-t-2xl max-h-[90svh] overflow-y-auto",
            "md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
            "md:w-full md:max-w-lg md:rounded-2xl md:max-h-[85svh]",
          ].join(" ")}
        >
          <div className="flex flex-col gap-6 p-6">
            {/* Steps 1..n: one category per step */}
            {step >= 1 && step <= totalCategorySteps && (() => {
              const cat = categoryForStep(step)!;
              const rawValue = values[cat.id] ?? "";
              const isSkipped = rawValue === SKIP;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-500">
                      Step {step} of {totalCategorySteps}
                    </span>
                    <button
                      onClick={tryClose}
                      aria-label="Close wizard"
                      className="rounded px-2 py-1 text-base text-neutral-600 hover:text-neutral-900"
                    >
                      ✕ Close
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div
                    role="progressbar"
                    aria-valuenow={step}
                    aria-valuemin={1}
                    aria-valuemax={totalCategorySteps}
                    className="h-2 w-full rounded-full bg-neutral-200"
                  >
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${(step / totalCategorySteps) * 100}%` }}
                    />
                  </div>

                  <div>
                    <h2 className="text-2xl font-semibold">{cat.name}</h2>
                    {cat.monthly_budget_cents !== null && (
                      <p className="mt-1 text-base text-neutral-500">
                        Budget: {formatDollars(cat.monthly_budget_cents)}/month
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="amount-input"
                      className="mb-2 block text-base font-medium"
                    >
                      About how much did you spend in {label}?
                    </label>
                    {isSkipped ? (
                      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                        <span className="flex-1 text-base text-neutral-500">Skipped</span>
                        <button
                          onClick={() => setValues((v) => ({ ...v, [cat.id]: "" }))}
                          className="text-sm font-medium text-blue-700 underline"
                          style={{ minHeight: 44 }}
                        >
                          Enter amount
                        </button>
                      </div>
                    ) : (
                      <input
                        id="amount-input"
                        type="text"
                        inputMode="numeric"
                        placeholder="$0"
                        value={rawValue}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [cat.id]: e.target.value }))
                        }
                        onBlur={(e) => {
                          const formatted = formatInputDisplay(e.target.value);
                          if (formatted !== e.target.value) {
                            setValues((v) => ({ ...v, [cat.id]: formatted }));
                          }
                        }}
                        className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ minHeight: 56 }}
                      />
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep((s) => s - 1)}
                      className="rounded-lg border border-neutral-300 px-4 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-50"
                      style={{ minHeight: 56 }}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => {
                        setValues((v) => ({ ...v, [cat.id]: SKIP }));
                        setStep((s) => s + 1);
                      }}
                      className="rounded-lg px-4 py-3 text-base font-medium text-neutral-500 hover:text-neutral-700 underline"
                      style={{ minHeight: 56 }}
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => setStep((s) => s + 1)}
                      disabled={!isSkipped && rawValue === ""}
                      className="flex-1 rounded-lg bg-blue-700 px-4 py-3 text-base font-semibold text-white hover:bg-blue-800 disabled:opacity-40"
                      style={{ minHeight: 56 }}
                    >
                      Next
                    </button>
                  </div>
                </>
              );
            })()}

            {/* Summary step */}
            {step === summaryStep && (
              <>
                <h2 className="text-2xl font-semibold">Review your entries</h2>
                <p className="text-base text-neutral-600">{label}</p>

                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="py-2 text-left font-medium text-neutral-600">Category</th>
                      <th className="py-2 text-right font-medium text-neutral-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => {
                      const raw = values[cat.id];
                      const isSkipped = !raw || raw === SKIP;
                      const cents = isSkipped ? null : parseDollarInput(raw);
                      return (
                        <tr key={cat.id} className="border-b border-neutral-100">
                          <td className="py-3">{cat.name}</td>
                          <td className="py-3 text-right text-neutral-500">
                            {isSkipped
                              ? "Skipped"
                              : cents !== null
                              ? formatDollars(cents)
                              : raw}
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

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(totalCategorySteps)}
                    className="rounded-lg border border-neutral-300 px-4 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-50"
                    style={{ minHeight: 56 }}
                  >
                    Go back
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-blue-700 px-4 py-3 text-base font-semibold text-white hover:bg-blue-800 disabled:opacity-40"
                    style={{ minHeight: 56 }}
                  >
                    {isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirm-close AlertDialog. Tailwind's z-index scale stops at z-50;
          z-60/z-70 are not real classes, so we pin these above the wizard
          (z-50) with inline styles. */}
      {confirmClose && (
        <>
          <div
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: 60 }}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            style={{ zIndex: 70 }}
            className={[
              "fixed bg-white rounded-2xl shadow-xl p-6",
              "inset-x-4 top-1/2 -translate-y-1/2",
              "md:left-1/2 md:right-auto md:inset-x-auto md:-translate-x-1/2 md:w-full md:max-w-sm",
            ].join(" ")}
          >
            <h2 id="confirm-title" className="text-xl font-semibold">
              Leave without saving?
            </h2>
            <p id="confirm-desc" className="mt-2 text-base text-neutral-600">
              Your entries won&rsquo;t be saved.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmClose(false)}
                className="flex-1 rounded-lg border border-neutral-300 px-4 py-3 text-base font-medium hover:bg-neutral-50"
                style={{ minHeight: 56 }}
              >
                Keep editing
              </button>
              <button
                onClick={closeWizard}
                className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-base font-semibold text-white hover:bg-red-700"
                style={{ minHeight: 56 }}
              >
                Leave
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
