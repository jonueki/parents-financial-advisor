export type BudgetCategory = {
  id: string;
  name: string;
  monthly_budget_cents: number | null;
};

export type CategoryActual = {
  category_id: string;
  year: number;
  month: number;
  amount_cents: number;
};
