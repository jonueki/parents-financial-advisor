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
  -- on delete set null so deleting an auth.users row that ever created a
  -- household preserves the household for surviving members.
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create type public.household_role as enum ('owner', 'viewer', 'accountant');

create table public.household_members (
  household_id  uuid not null references public.households(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  -- Default 'viewer' so omitting the role at insert is fail-safe; the
  -- household creator gets 'owner' via the admin bootstrap flow, and
  -- invite redemption reads the role from household_invites.role.
  role          public.household_role not null default 'viewer',
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
  -- Role the redeemer receives. Stored on the invite so the inviter chooses
  -- the privilege level. Default 'viewer' is fail-safe — owners require an
  -- explicit pick.
  role          public.household_role not null default 'viewer',
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  consumed_by   uuid references public.profiles(id) on delete set null
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

-- ---------------------------------------------------------------------------
-- Column-level grants
-- ---------------------------------------------------------------------------

-- Belt + suspenders with profiles_update_self: even if the policy were to
-- regress, the authenticated role only holds UPDATE on display_name. email
-- is sourced from auth.users via the handle_new_user trigger and should
-- never be writable by the user themselves (admin views display this
-- column; user-controlled rewriting would let people impersonate others
-- in admin UIs).
--
-- Consequence: UPDATEs on non-display_name columns by anon-key callers
-- are blocked at the grant layer before RLS is consulted, so the
-- profiles_admin_write policy is effectively unreachable for UPDATE from
-- the user-session client. INSERT and DELETE still go through the
-- policy (the column grant only restricts UPDATE) — those paths are
-- still RLS-protected. In practice every admin profile mutation in this
-- codebase goes through createSupabaseAdminClient() (service-role),
-- which bypasses both grants and RLS. Don't write admin profile
-- UPDATEs via the user-session client.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic invite redemption
-- ---------------------------------------------------------------------------

-- Single-statement claim + membership insert. Runs as definer so it
-- bypasses the admin-only write policies on household_members. Identity
-- (user id, user email) is read from auth.uid() / auth.users inside the
-- function — never accepted as a parameter — so a caller cannot redeem
-- on behalf of someone else.
--
-- Returns the (household_id, role) pair on success. Returns no rows when
-- the invite is missing, expired, already consumed, or email-bound to a
-- different address.
--
-- The atomic UPDATE ... WHERE consumed_at IS NULL is the race-free gate:
-- only one concurrent caller can flip the row from null to a timestamp.
create or replace function public.redeem_invite(p_token_hash text)
returns table (household_id uuid, role public.household_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite     public.household_invites%rowtype;
  v_user_id    uuid := auth.uid();
  v_user_email text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select email into v_user_email from auth.users where id = v_user_id;

  select * into v_invite
  from public.household_invites
  where token_hash = p_token_hash;

  if not found then
    return;
  end if;
  if v_invite.email is not null
     and lower(v_invite.email) <> lower(coalesce(v_user_email, '')) then
    return;
  end if;

  update public.household_invites
     set consumed_at = now(),
         consumed_by = v_user_id
   where id = v_invite.id
     and consumed_at is null
     and expires_at > now()
  returning * into v_invite;

  if not found then
    return;
  end if;

  -- ON CONFLICT DO UPDATE: invite redemption is authoritative for role.
  -- If the user was already a member of this household (e.g. admin added
  -- them as 'viewer' before they redeemed an 'accountant' invite), the
  -- redemption upgrades/changes their role to whatever the inviter chose.
  insert into public.household_members (household_id, profile_id, role)
  values (v_invite.household_id, v_user_id, v_invite.role)
  on conflict (household_id, profile_id) do update
    set role = excluded.role;

  household_id := v_invite.household_id;
  role := v_invite.role;
  return next;
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic member removal
-- ---------------------------------------------------------------------------

-- Race-free version of "remove a member if doing so won't drop the household
-- to zero owners." A check-then-delete in app code is vulnerable to two
-- admins concurrently removing different owners — both pass the count
-- check, both delete, household ends with zero owners. This function
-- takes a row lock on every owner row before counting, so concurrent
-- callers serialize.
--
-- Returns the number of rows actually deleted (0 if the target wasn't a
-- member; 1 on success). Raises if the removal would drop owner count
-- below 1.
create or replace function public.remove_member(
  p_household_id uuid,
  p_profile_id   uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role public.household_role;
  v_other_owner_count integer;
  v_deleted     integer;
begin
  -- Lock the target row first.
  select role into v_target_role
  from public.household_members
  where household_id = p_household_id and profile_id = p_profile_id
  for update;

  if not found then
    return 0;
  end if;

  if v_target_role = 'owner' then
    -- Lock every owner row for this household via CTE, then count over
    -- the locked set. Postgres rejects FOR UPDATE alongside an aggregate
    -- in the same statement, so the lock and the count live in separate
    -- clauses of the same query.
    with locked as (
      select profile_id
      from public.household_members
      where household_id = p_household_id and role = 'owner'
      for update
    )
    select count(*) into v_other_owner_count
    from locked
    where profile_id <> p_profile_id;

    if v_other_owner_count < 1 then
      raise exception 'cannot remove last owner of household %', p_household_id
        using errcode = '23514';
    end if;
  end if;

  delete from public.household_members
  where household_id = p_household_id and profile_id = p_profile_id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- This function is only called from server-side admin code (which already
-- checks profiles.is_admin before calling). It still uses SECURITY DEFINER
-- because household_members has admin-only RLS for writes, but the admin
-- check belongs at the application boundary.
revoke all on function public.remove_member(uuid, uuid) from public;
grant execute on function public.remove_member(uuid, uuid) to service_role;
