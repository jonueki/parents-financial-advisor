-- budget_categories
create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  monthly_budget_cents integer check (monthly_budget_cents >= 0),
  annual_budget_cents integer check (annual_budget_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table budget_categories enable row level security;
create policy "members and admins" on budget_categories
  for all using (is_member_of(household_id) or is_admin())
  with check (is_member_of(household_id) or is_admin());

-- category_actuals
create table category_actuals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid not null references budget_categories(id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  month integer not null check (month >= 1 and month <= 12),
  amount_cents integer not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, year, month)
);

alter table category_actuals enable row level security;
create policy "members and admins" on category_actuals
  for all using (is_member_of(household_id) or is_admin())
  with check (is_member_of(household_id) or is_admin());

-- income_streams
create table income_streams (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  expected_monthly_cents integer check (expected_monthly_cents >= 0),
  created_at timestamptz not null default now()
);

alter table income_streams enable row level security;
create policy "members and admins" on income_streams
  for all using (is_member_of(household_id) or is_admin())
  with check (is_member_of(household_id) or is_admin());

-- income_actuals
create table income_actuals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  income_stream_id uuid not null references income_streams(id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  month integer not null check (month >= 1 and month <= 12),
  amount_cents integer not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (income_stream_id, year, month)
);

alter table income_actuals enable row level security;
create policy "members and admins" on income_actuals
  for all using (is_member_of(household_id) or is_admin())
  with check (is_member_of(household_id) or is_admin());

-- accounts
create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type text not null check (type in ('checking','savings','investment','retirement','credit_card','mortgage','loan','other')),
  is_liability boolean not null default false,
  current_balance_cents integer not null default 0,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;
create policy "members and admins" on accounts
  for all using (is_member_of(household_id) or is_admin())
  with check (is_member_of(household_id) or is_admin());

-- account_snapshots
create table account_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  balance_cents integer not null,
  snapshot_date date not null,
  created_at timestamptz not null default now(),
  unique (account_id, snapshot_date)
);

alter table account_snapshots enable row level security;
create policy "members and admins can manage snapshots" on account_snapshots
  for all using (
    exists (
      select 1 from accounts a
      where a.id = account_snapshots.account_id
      and (is_member_of(a.household_id) or is_admin())
    )
  )
  with check (
    exists (
      select 1 from accounts a
      where a.id = account_snapshots.account_id
      and (is_member_of(a.household_id) or is_admin())
    )
  );

-- goals
create table goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  target_amount_cents integer not null check (target_amount_cents >= 0),
  target_date date,
  saved_cents integer not null default 0 check (saved_cents >= 0),
  status text not null default 'planning' check (status in ('planning','saving','booked','done','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

alter table goals enable row level security;
create policy "members and admins" on goals
  for all using (is_member_of(household_id) or is_admin())
  with check (is_member_of(household_id) or is_admin());

-- Seed default budget categories for new households
create or replace function seed_default_categories(hid uuid) returns void
  language plpgsql security definer as $$
begin
  insert into budget_categories (household_id, name, monthly_budget_cents) values
    (hid, 'Groceries', 60000),
    (hid, 'Utilities', 25000),
    (hid, 'Housing', 150000),
    (hid, 'Transport', 30000),
    (hid, 'Healthcare', 20000),
    (hid, 'Insurance', 40000),
    (hid, 'Dining', 20000),
    (hid, 'Entertainment', 10000),
    (hid, 'Gifts', 10000),
    (hid, 'Misc', 15000);
end;
$$;
