"use client";

import { useState, useTransition } from "react";
import { fetchActualsForMonth, saveActuals } from "./actions";

export type Category = {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
};

type EntryState =
  | { status: "pending" }
  | { status: "skipped" }
  | { status: "entered"; amountCents: number };

type WizardStep = "month" | number | "summary";

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

function formatAmount(cents: number): string {
  return "$" + Math.round(cents / 100).toLocaleString("en-US");
}

function parseCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (cleaned === "") return null;
  const num = parseInt(cleaned, 10);
  if (isNaN(num) || num < 0 || num > 999999) return null;
  return num * 100;
}

function getMonthOptions(
  fromYear: number,
  fromMonth: number,
): { year: number; month: number }[] {
  const options: { year: number; month: number }[] = [];
  let y = fromYear;
  let m = fromMonth;
  for (let i = 0; i < 12; i++) {
    options.push({ year: y, month: m });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return options;
}

type Props = {
  householdId: string;
  categories: Category[];
  defaultYear: number;
  defaultMonth: number;
  hasMissingLastMonth: boolean;
  lastMonthName: string;
  hasAnyActuals: boolean;
};

export default function BudgetWizard({
  householdId,
  categories,
  defaultYear,
  defaultMonth,
  hasMissingLastMonth,
  lastMonthName,
  hasAnyActuals,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [step, setStep] = useState<WizardStep>("month");
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [entries, setEntries] = useState<Record<string, EntryState>>({});
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const monthOptions = getMonthOptions(defaultYear, defaultMonth);

  function openWizard() {
    setStep("month");
    setYear(defaultYear);
    setMonth(defaultMonth);
    setEntries({});
    setRawInputs({});
    setSaveError(null);
    setOpen(true);
  }

  function closeWizard() {
    setOpen(false);
    setShowCloseConfirm(false);
  }

  function requestClose() {
    if (step !== "month") {
      setShowCloseConfirm(true);
    } else {
      closeWizard();
    }
  }

  function handleAdvanceFromMonth() {
    startTransition(async () => {
      const actuals = await fetchActualsForMonth(householdId, year, month);
      const initialEntries: Record<string, EntryState> = {};
      const initialRawInputs: Record<string, string> = {};
      for (const a of actuals) {
        initialEntries[a.categoryId] = {
          status: "entered",
          amountCents: a.amountCents,
        };
        initialRawInputs[a.categoryId] = Math.round(
          a.amountCents / 100,
        ).toLocaleString("en-US");
      }
      setEntries(initialEntries);
      setRawInputs(initialRawInputs);
      setStep(0);
    });
  }

  function handleInputBlur(categoryId: string, raw: string) {
    const cents = parseCents(raw);
    if (cents !== null) {
      setRawInputs((prev) => ({
        ...prev,
        [categoryId]: Math.round(cents / 100).toLocaleString("en-US"),
      }));
      setEntries((prev) => ({
        ...prev,
        [categoryId]: { status: "entered", amountCents: cents },
      }));
    }
  }

  function commitAndAdvance(index: number) {
    const cat = categories[index];
    const raw = rawInputs[cat.id] ?? "";
    const cents = parseCents(raw);
    if (cents !== null) {
      setEntries((prev) => ({
        ...prev,
        [cat.id]: { status: "entered", amountCents: cents },
      }));
    }
    if (index < categories.length - 1) {
      setStep(index + 1);
    } else {
      setStep("summary");
    }
  }

  function handleSkip(index: number) {
    const cat = categories[index];
    setEntries((prev) => ({ ...prev, [cat.id]: { status: "skipped" } }));
    if (index < categories.length - 1) {
      setStep(index + 1);
    } else {
      setStep("summary");
    }
  }

  function handlePrevious() {
    if (step === "summary") {
      setStep(categories.length - 1);
    } else if (typeof step === "number") {
      setStep(step === 0 ? "month" : step - 1);
    }
  }

  function handleSave() {
    const toSave = categories
      .filter((cat) => {
        const e = entries[cat.id];
        return e?.status === "entered";
      })
      .map((cat) => {
        const e = entries[cat.id] as { status: "entered"; amountCents: number };
        return { categoryId: cat.id, amountCents: e.amountCents };
      });

    startTransition(async () => {
      const result = await saveActuals(householdId, year, month, toSave);
      if (result.error) {
        setSaveError(result.error);
      } else {
        closeWizard();
      }
    });
  }

  const selectedMonthName = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <>
      {hasMissingLastMonth && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-base">
            You haven&apos;t recorded {lastMonthName} yet.
          </p>
          <button
            onClick={openWizard}
            className="shrink-0 rounded-lg bg-blue-700 px-5 text-base font-semibold text-white"
            style={{ minHeight: "56px" }}
          >
            Add now
          </button>
        </div>
      )}

      {!hasAnyActuals && (
        <div className="rounded-lg border border-neutral-200 p-6">
          <p className="text-base text-neutral-600">
            No spending recorded yet. Tap &ldquo;Add now&rdquo; to get started.
          </p>
        </div>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            aria-hidden="true"
            onClick={requestClose}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Monthly spending wizard"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-2xl bg-white shadow-xl
              md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-neutral-300 md:hidden" />

            <div className="flex flex-1 flex-col overflow-hidden p-6">
              {step === "month" && (
                <MonthStep
                  year={year}
                  month={month}
                  monthOptions={monthOptions}
                  isPending={isPending}
                  onSelectMonth={(y, m) => {
                    setYear(y);
                    setMonth(m);
                  }}
                  onCancel={closeWizard}
                  onNext={handleAdvanceFromMonth}
                />
              )}

              {typeof step === "number" && (
                <CategoryStep
                  index={step}
                  total={categories.length}
                  category={categories[step]}
                  monthName={selectedMonthName}
                  rawValue={rawInputs[categories[step].id] ?? ""}
                  onChangeRaw={(v) =>
                    setRawInputs((prev) => ({
                      ...prev,
                      [categories[step].id]: v,
                    }))
                  }
                  onBlur={(raw) => handleInputBlur(categories[step].id, raw)}
                  onClose={requestClose}
                  onPrevious={handlePrevious}
                  onSkip={() => handleSkip(step)}
                  onNext={() => commitAndAdvance(step)}
                />
              )}

              {step === "summary" && (
                <SummaryStep
                  year={year}
                  month={month}
                  categories={categories}
                  entries={entries}
                  isPending={isPending}
                  saveError={saveError}
                  onClose={requestClose}
                  onBack={handlePrevious}
                  onSave={handleSave}
                />
              )}
            </div>
          </div>
        </>
      )}

      {showCloseConfirm && (
        <>
          <div className="fixed inset-0 z-60 bg-black/50" aria-hidden="true" />
          <div
            role="alertdialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[70] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-xl font-semibold">Leave without saving?</h2>
            <p className="mt-2 text-base text-neutral-600">
              Your entries won&apos;t be saved.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={closeWizard}
                className="h-14 w-full rounded-lg bg-red-700 text-base font-semibold text-white"
              >
                Leave
              </button>
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="h-14 w-full rounded-lg border border-neutral-300 text-base font-semibold"
              >
                Stay
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MonthStep({
  year,
  month,
  monthOptions,
  isPending,
  onSelectMonth,
  onCancel,
  onNext,
}: {
  year: number;
  month: number;
  monthOptions: { year: number; month: number }[];
  isPending: boolean;
  onSelectMonth: (year: number, month: number) => void;
  onCancel: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <h2 className="text-2xl font-semibold">Which month?</h2>
      <p className="mt-1 text-base text-neutral-600">
        Select the month you want to record spending for.
      </p>
      <ul className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {monthOptions.map((opt) => {
          const label = `${MONTH_NAMES[opt.month - 1]} ${opt.year}`;
          const selected = opt.year === year && opt.month === month;
          return (
            <li key={`${opt.year}-${opt.month}`}>
              <button
                onClick={() => onSelectMonth(opt.year, opt.month)}
                className={`h-14 w-full rounded-lg border px-4 text-left text-base font-medium
                  ${
                    selected
                      ? "border-blue-700 bg-blue-50 text-blue-700"
                      : "border-neutral-200 hover:bg-neutral-50"
                  }`}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex gap-3">
        <button
          onClick={onCancel}
          className="h-14 flex-1 rounded-lg border border-neutral-300 text-base font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onNext}
          disabled={isPending}
          className="h-14 flex-1 rounded-lg bg-blue-700 text-base font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Next"}
        </button>
      </div>
    </>
  );
}

function CategoryStep({
  index,
  total,
  category,
  monthName,
  rawValue,
  onChangeRaw,
  onBlur,
  onClose,
  onPrevious,
  onSkip,
  onNext,
}: {
  index: number;
  total: number;
  category: Category;
  monthName: string;
  rawValue: string;
  onChangeRaw: (v: string) => void;
  onBlur: (raw: string) => void;
  onClose: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-sm text-neutral-500">
          Step {index + 1} of {total}
        </span>
        <button
          onClick={onClose}
          aria-label="Close wizard"
          className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          ✕
        </button>
      </div>

      <div
        className="mt-2 shrink-0 h-2 rounded-full bg-neutral-100"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div
          className="h-2 rounded-full bg-blue-700 transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <div className="mt-6 flex-1 overflow-y-auto">
        <h2 className="text-2xl font-semibold">{category.name}</h2>
        {category.monthly_budget_cents !== null && (
          <p className="mt-1 text-base text-neutral-500">
            Budget: {formatAmount(category.monthly_budget_cents)}/month
          </p>
        )}

        <label className="mt-6 block">
          <span className="text-base font-medium">
            About how much did you spend in {monthName}?
          </span>
          <div className="mt-2 flex items-center rounded-lg border border-neutral-300 focus-within:border-blue-700">
            <span className="pl-4 text-base text-neutral-500">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={rawValue}
              onChange={(e) => onChangeRaw(e.target.value)}
              onBlur={(e) => onBlur(e.target.value)}
              placeholder="0"
              className="h-14 flex-1 bg-transparent px-2 text-base outline-none"
            />
          </div>
        </label>
      </div>

      <div className="mt-6 shrink-0 flex flex-col gap-3">
        <button
          onClick={onNext}
          className="h-14 w-full rounded-lg bg-blue-700 text-base font-semibold text-white"
        >
          Next
        </button>
        <div className="flex gap-3">
          <button
            onClick={onPrevious}
            className="h-14 flex-1 rounded-lg border border-neutral-300 text-base font-medium"
          >
            Previous
          </button>
          <button
            onClick={onSkip}
            className="h-14 flex-1 rounded-lg border border-neutral-300 text-base font-medium text-neutral-500"
          >
            Skip
          </button>
        </div>
      </div>
    </>
  );
}

function SummaryStep({
  year,
  month,
  categories,
  entries,
  isPending,
  saveError,
  onClose,
  onBack,
  onSave,
}: {
  year: number;
  month: number;
  categories: Category[];
  entries: Record<string, EntryState>;
  isPending: boolean;
  saveError: string | null;
  onClose: () => void;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Summary</h2>
          <p className="text-base text-neutral-500">
            {MONTH_NAMES[month - 1]} {year}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close wizard"
          className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          ✕
        </button>
      </div>

      {saveError && (
        <div className="mt-3 shrink-0 rounded-lg bg-red-50 p-3">
          <p className="text-base text-red-700">{saveError}</p>
        </div>
      )}

      <div className="mt-4 flex-1 overflow-y-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="pb-2 text-left text-base font-medium text-neutral-600">
                Category
              </th>
              <th className="pb-2 text-right text-base font-medium text-neutral-600">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const entry = entries[cat.id];
              let display: React.ReactNode;
              if (!entry || entry.status === "pending") {
                display = <span className="text-neutral-400">—</span>;
              } else if (entry.status === "skipped") {
                display = <span className="text-neutral-400">Skipped</span>;
              } else {
                display = formatAmount(entry.amountCents);
              }
              return (
                <tr key={cat.id} className="border-b border-neutral-100">
                  <td className="py-3 text-base">{cat.name}</td>
                  <td className="py-3 text-right text-base">{display}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 shrink-0 flex flex-col gap-3">
        <button
          onClick={onSave}
          disabled={isPending}
          className="h-14 w-full rounded-lg bg-blue-700 text-base font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onBack}
          className="h-14 w-full rounded-lg border border-neutral-300 text-base font-medium"
        >
          Go back
        </button>
      </div>
    </>
  );
}
