-- Enable pgcrypto for gen_random_bytes
create extension if not exists pgcrypto;

-- profiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "users can read own profile" on profiles
  for select using ((select auth.uid()) = id);
create policy "users can update own profile" on profiles
  for update using ((select auth.uid()) = id);
create policy "admins can read all profiles" on profiles
  for select using (exists (select 1 from profiles where id = (select auth.uid()) and is_admin));

-- households
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

alter table households enable row level security;

-- household_members
create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'viewer', 'accountant')),
  joined_at timestamptz not null default now(),
  primary key (household_id, profile_id)
);

alter table household_members enable row level security;

-- Helper function: is member of a household
create or replace function is_member_of(hid uuid) returns boolean
  language sql security definer stable as $$
    select exists (
      select 1 from household_members
      where household_id = hid and profile_id = (select auth.uid())
    )
  $$;

-- Helper function: is admin
create or replace function is_admin() returns boolean
  language sql security definer stable as $$
    select exists (select 1 from profiles where id = (select auth.uid()) and is_admin)
  $$;

-- RLS on households
create policy "members and admins can read households" on households
  for select using (is_member_of(id) or is_admin());

-- RLS on household_members
create policy "members and admins can read household_members" on household_members
  for select using (is_member_of(household_id) or is_admin());

-- household_invites
create table household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  token_hash text not null unique,
  email text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references profiles(id)
);

alter table household_invites enable row level security;
create policy "members can read own household invites" on household_invites
  for select using (is_member_of(household_id) or is_admin());

-- audit_log
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references profiles(id),
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

alter table audit_log enable row level security;
create policy "admins only" on audit_log for select using (is_admin());

-- Auto-create profile on sign-up
create or replace function handle_new_user() returns trigger
  language plpgsql security definer as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
