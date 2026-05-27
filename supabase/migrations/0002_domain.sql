-- 0002_domain.sql — budget categories and monthly actuals.

set search_path = public;

-- ---------------------------------------------------------------------------
-- budget_categories
-- ---------------------------------------------------------------------------

create table public.budget_categories (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households(id) on delete cascade,
  name                  text not null,
  monthly_budget_cents  integer check (monthly_budget_cents > 0),
  position              integer not null default 0,
  created_at            timestamptz not null default now()
);

create index budget_categories_household_idx
  on public.budget_categories (household_id, position);

-- ---------------------------------------------------------------------------
-- category_actuals
-- ---------------------------------------------------------------------------

create table public.category_actuals (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  category_id    uuid not null references public.budget_categories(id) on delete cascade,
  year           integer not null,
  month          integer not null check (month between 1 and 12),
  amount_cents   integer not null check (amount_cents >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (category_id, year, month)
);

create index category_actuals_household_month_idx
  on public.category_actuals (household_id, year desc, month desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.budget_categories  enable row level security;
alter table public.category_actuals   enable row level security;

create policy "budget_categories_member_or_admin"
  on public.budget_categories for all
  using (public.is_member_of(household_id) or public.is_admin())
  with check (public.is_member_of(household_id) or public.is_admin());

create policy "category_actuals_member_or_admin"
  on public.category_actuals for all
  using (public.is_member_of(household_id) or public.is_admin())
  with check (public.is_member_of(household_id) or public.is_admin());
