-- Identity & access tables

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create type public.member_role as enum ('owner');

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'owner',
  joined_at timestamptz not null default now(),
  primary key (household_id, profile_id)
);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token_hash text not null unique,
  email text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references public.profiles(id)
);

-- Audit log

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  actor_email text,
  household_id uuid,
  action_type text not null,
  target_table text,
  target_id uuid,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Helper functions for RLS

create or replace function public.is_member_of(p_household_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id
      and profile_id = (select auth.uid())
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = (select auth.uid())),
    false
  )
$$;

-- Enable RLS

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.audit_log enable row level security;

-- profiles: user can read/update their own; admin can read all

create policy "profiles_select" on public.profiles
  for select using (id = (select auth.uid()) or public.is_admin());

create policy "profiles_insert" on public.profiles
  for insert with check (id = (select auth.uid()));

create policy "profiles_update" on public.profiles
  for update using (id = (select auth.uid()) or public.is_admin());

-- households: members or admin

create policy "households_select" on public.households
  for select using (public.is_member_of(id) or public.is_admin());

create policy "households_insert" on public.households
  for insert with check (public.is_admin() or true);

create policy "households_update" on public.households
  for update using (public.is_member_of(id) or public.is_admin());

-- household_members

create policy "members_select" on public.household_members
  for select using (public.is_member_of(household_id) or public.is_admin());

create policy "members_insert" on public.household_members
  for insert with check (public.is_admin() or true);

create policy "members_delete" on public.household_members
  for delete using (public.is_member_of(household_id) or public.is_admin());

-- household_invites

create policy "invites_select" on public.household_invites
  for select using (public.is_member_of(household_id) or public.is_admin());

create policy "invites_insert" on public.household_invites
  for insert with check (public.is_member_of(household_id) or public.is_admin());

create policy "invites_update" on public.household_invites
  for update using (public.is_member_of(household_id) or public.is_admin());

-- audit_log: admin only

create policy "audit_log_select" on public.audit_log
  for select using (public.is_admin());

create policy "audit_log_insert" on public.audit_log
  for insert with check (true);

-- Auto-create profile on sign-up

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
