-- Domain tables: assets, budgeting, income, goals

-- Accounts

create type public.account_type as enum (
  'checking', 'savings', 'investment', 'retirement',
  'credit_card', 'mortgage', 'loan', 'other'
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  type public.account_type not null,
  is_liability boolean not null default false,
  current_balance_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  balance_cents bigint not null,
  snapshot_date date not null,
  unique (account_id, snapshot_date)
);

-- Budget categories

create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  monthly_budget_cents bigint,
  annual_budget_cents bigint,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Category actuals: one row per category per month

create table public.category_actuals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.budget_categories(id) on delete cascade,
  year int not null,
  month int not null check (month >= 1 and month <= 12),
  amount_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, year, month)
);

-- Income streams

create table public.income_streams (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  expected_monthly_cents bigint,
  created_at timestamptz not null default now()
);

-- Income actuals: one row per stream per month

create table public.income_actuals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  income_stream_id uuid not null references public.income_streams(id) on delete cascade,
  year int not null,
  month int not null check (month >= 1 and month <= 12),
  amount_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (income_stream_id, year, month)
);

-- Goals

create type public.goal_status as enum (
  'planning', 'saving', 'booked', 'done', 'cancelled'
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  target_amount_cents bigint not null,
  target_date date,
  saved_cents bigint not null default 0,
  status public.goal_status not null default 'planning',
  notes text,
  created_at timestamptz not null default now()
);

-- Enable RLS on all domain tables

alter table public.accounts enable row level security;
alter table public.account_snapshots enable row level security;
alter table public.budget_categories enable row level security;
alter table public.category_actuals enable row level security;
alter table public.income_streams enable row level security;
alter table public.income_actuals enable row level security;
alter table public.goals enable row level security;

-- RLS policies: member or admin on household_id

create policy "accounts_select" on public.accounts
  for select using (public.is_member_of(household_id) or public.is_admin());
create policy "accounts_insert" on public.accounts
  for insert with check (public.is_member_of(household_id) or public.is_admin());
create policy "accounts_update" on public.accounts
  for update using (public.is_member_of(household_id) or public.is_admin());
create policy "accounts_delete" on public.accounts
  for delete using (public.is_member_of(household_id) or public.is_admin());

create policy "account_snapshots_select" on public.account_snapshots
  for select using (
    exists (
      select 1 from public.accounts a
      where a.id = account_id
        and (public.is_member_of(a.household_id) or public.is_admin())
    )
  );
create policy "account_snapshots_insert" on public.account_snapshots
  for insert with check (
    exists (
      select 1 from public.accounts a
      where a.id = account_id
        and (public.is_member_of(a.household_id) or public.is_admin())
    )
  );
create policy "account_snapshots_update" on public.account_snapshots
  for update using (
    exists (
      select 1 from public.accounts a
      where a.id = account_id
        and (public.is_member_of(a.household_id) or public.is_admin())
    )
  );

create policy "budget_categories_select" on public.budget_categories
  for select using (public.is_member_of(household_id) or public.is_admin());
create policy "budget_categories_insert" on public.budget_categories
  for insert with check (public.is_member_of(household_id) or public.is_admin());
create policy "budget_categories_update" on public.budget_categories
  for update using (public.is_member_of(household_id) or public.is_admin());
create policy "budget_categories_delete" on public.budget_categories
  for delete using (public.is_member_of(household_id) or public.is_admin());

create policy "category_actuals_select" on public.category_actuals
  for select using (public.is_member_of(household_id) or public.is_admin());
create policy "category_actuals_insert" on public.category_actuals
  for insert with check (public.is_member_of(household_id) or public.is_admin());
create policy "category_actuals_update" on public.category_actuals
  for update using (public.is_member_of(household_id) or public.is_admin());
create policy "category_actuals_delete" on public.category_actuals
  for delete using (public.is_member_of(household_id) or public.is_admin());

create policy "income_streams_select" on public.income_streams
  for select using (public.is_member_of(household_id) or public.is_admin());
create policy "income_streams_insert" on public.income_streams
  for insert with check (public.is_member_of(household_id) or public.is_admin());
create policy "income_streams_update" on public.income_streams
  for update using (public.is_member_of(household_id) or public.is_admin());
create policy "income_streams_delete" on public.income_streams
  for delete using (public.is_member_of(household_id) or public.is_admin());

create policy "income_actuals_select" on public.income_actuals
  for select using (public.is_member_of(household_id) or public.is_admin());
create policy "income_actuals_insert" on public.income_actuals
  for insert with check (public.is_member_of(household_id) or public.is_admin());
create policy "income_actuals_update" on public.income_actuals
  for update using (public.is_member_of(household_id) or public.is_admin());
create policy "income_actuals_delete" on public.income_actuals
  for delete using (public.is_member_of(household_id) or public.is_admin());

create policy "goals_select" on public.goals
  for select using (public.is_member_of(household_id) or public.is_admin());
create policy "goals_insert" on public.goals
  for insert with check (public.is_member_of(household_id) or public.is_admin());
create policy "goals_update" on public.goals
  for update using (public.is_member_of(household_id) or public.is_admin());
create policy "goals_delete" on public.goals
  for delete using (public.is_member_of(household_id) or public.is_admin());
