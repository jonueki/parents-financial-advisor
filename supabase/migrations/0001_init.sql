-- 0001_init.sql — identity, access, and audit foundation.
-- Domain tables (accounts, categories, goals, …) land in a later migration.

set search_path = public;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- security definer so policies can ask "is the caller an admin?" without
-- recursing through profiles' own RLS.
create or replace function public.is_admin() returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = (select auth.uid())),
    false
  );
$$;

create or replace function public.is_member_of(p_household_id uuid) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id
      and profile_id = (select auth.uid())
  );
$$;

create or replace function public.is_owner_of(p_household_id uuid) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id
      and profile_id = (select auth.uid())
      and role = 'owner'
  );
$$;

create or replace function public.shares_household_with(p_profile_id uuid) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members them on me.household_id = them.household_id
    where me.profile_id = (select auth.uid())
      and them.profile_id = p_profile_id
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Auto-create a profile row for every new auth.users insert.
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- households + membership
-- ---------------------------------------------------------------------------

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

create type public.household_role as enum ('owner', 'viewer', 'accountant');

create table public.household_members (
  household_id  uuid not null references public.households(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  role          public.household_role not null default 'owner',
  joined_at     timestamptz not null default now(),
  primary key (household_id, profile_id)
);

create index household_members_profile_idx on public.household_members (profile_id);

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------

create table public.household_invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  token_hash    text not null unique,
  email         text,
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  consumed_by   uuid references public.profiles(id)
);

create index household_invites_household_idx
  on public.household_invites (household_id);

create index household_invites_active_idx
  on public.household_invites (expires_at)
  where consumed_at is null;

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id                uuid primary key default gen_random_uuid(),
  actor_profile_id  uuid references public.profiles(id) on delete set null,
  actor_email       text,
  household_id      uuid references public.households(id) on delete set null,
  action_type       text not null,
  target_table      text,
  target_id         uuid,
  metadata          jsonb,
  ip_address        inet,
  user_agent        text,
  created_at        timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_household_idx
  on public.audit_log (household_id, created_at desc);
create index audit_log_actor_idx
  on public.audit_log (actor_profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.households          enable row level security;
alter table public.household_members   enable row level security;
alter table public.household_invites   enable row level security;
alter table public.audit_log           enable row level security;

-- profiles --------------------------------------------------------------
create policy "profiles_select"
  on public.profiles for select
  using (
    id = (select auth.uid())
    or public.shares_household_with(id)
    or public.is_admin()
  );

-- A user may update their own display_name. They cannot promote themselves
-- to admin: WITH CHECK pins is_admin to its prior value.
create policy "profiles_update_self"
  on public.profiles for update
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and is_admin = (select p.is_admin from public.profiles p where p.id = (select auth.uid()))
  );

create policy "profiles_admin_write"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- households ------------------------------------------------------------
create policy "households_select"
  on public.households for select
  using (public.is_member_of(id) or public.is_admin());

create policy "households_update"
  on public.households for update
  using (public.is_owner_of(id) or public.is_admin())
  with check (public.is_owner_of(id) or public.is_admin());

create policy "households_admin_write"
  on public.households for all
  using (public.is_admin())
  with check (public.is_admin());

-- household_members -----------------------------------------------------
-- Reads: members can see who else is in their households.
-- Writes go through service-role server actions (invite redemption,
-- admin "remove member") so no user-level INSERT/UPDATE/DELETE policy.
create policy "household_members_select"
  on public.household_members for select
  using (public.is_member_of(household_id) or public.is_admin());

create policy "household_members_admin_write"
  on public.household_members for all
  using (public.is_admin())
  with check (public.is_admin());

-- household_invites -----------------------------------------------------
-- Owners of a household can CRUD its invites. Admin can do anything.
-- Invite redemption itself runs via service-role (the redeemer is not yet
-- a member, so RLS would block them).
create policy "household_invites_owner_or_admin"
  on public.household_invites for all
  using (public.is_owner_of(household_id) or public.is_admin())
  with check (public.is_owner_of(household_id) or public.is_admin());

-- audit_log -------------------------------------------------------------
-- Admin-read-only. Writes always go through service-role helpers.
create policy "audit_log_admin_only"
  on public.audit_log for all
  using (public.is_admin())
  with check (public.is_admin());
