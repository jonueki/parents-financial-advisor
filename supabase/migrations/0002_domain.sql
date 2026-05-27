-- 0002_domain.sql — budget categories and actuals (expense side).

set search_path = public;

-- ---------------------------------------------------------------------------
-- budget_categories
-- ---------------------------------------------------------------------------

create table public.budget_categories (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households(id) on delete cascade,
  name                  text not null,
  monthly_budget_cents  integer check (monthly_budget_cents >= 0),
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now()
);

create index budget_categories_household_idx
  on public.budget_categories (household_id, sort_order);

-- ---------------------------------------------------------------------------
-- category_actuals
-- ---------------------------------------------------------------------------

create table public.category_actuals (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  category_id    uuid not null references public.budget_categories(id) on delete cascade,
  year           integer not null check (year >= 2000 and year <= 2100),
  month          integer not null check (month >= 1 and month <= 12),
  amount_cents   integer not null check (amount_cents >= 0),
  created_at     timestamptz not null default now(),
  unique (category_id, year, month)
);

create index category_actuals_household_idx
  on public.category_actuals (household_id, year, month);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.budget_categories  enable row level security;
alter table public.category_actuals   enable row level security;

-- budget_categories
create policy "budget_categories_select"
  on public.budget_categories for select
  using (public.is_member_of(household_id) or public.is_admin());

create policy "budget_categories_insert"
  on public.budget_categories for insert
  with check (public.is_member_of(household_id) or public.is_admin());

create policy "budget_categories_update"
  on public.budget_categories for update
  using (public.is_member_of(household_id) or public.is_admin())
  with check (public.is_member_of(household_id) or public.is_admin());

create policy "budget_categories_delete"
  on public.budget_categories for delete
  using (public.is_member_of(household_id) or public.is_admin());

-- category_actuals
create policy "category_actuals_select"
  on public.category_actuals for select
  using (public.is_member_of(household_id) or public.is_admin());

create policy "category_actuals_insert"
  on public.category_actuals for insert
  with check (public.is_member_of(household_id) or public.is_admin());

create policy "category_actuals_update"
  on public.category_actuals for update
  using (public.is_member_of(household_id) or public.is_admin())
  with check (public.is_member_of(household_id) or public.is_admin());

create policy "category_actuals_delete"
  on public.category_actuals for delete
  using (public.is_member_of(household_id) or public.is_admin());
