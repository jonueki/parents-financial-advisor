# Phase 1 handoff

This file is the pickup point for the next Claude Code session. Read top-to-bottom; everything you need to resume work is here.

---

## For the next Claude session — read this first

You are picking up a personal project: a multi-tenant household budgeting web app for the user's parents and in-laws. **Phase 1 is complete and committed** (identity, auth, RLS, admin dashboard, deploy pipeline — no domain features yet). Nothing is pending from the previous session.

**Before doing anything:**

1. Read `AGENTS.md` at repo root. **This is Next.js 16, which has breaking changes from your training data.** The bundled docs at `node_modules/next/dist/docs/` are the source of truth. Specifically: middleware was renamed to `proxy.ts` (function name `proxy`, Node runtime only); `cookies()` is fully async (no sync fallback).
2. Read the rest of this file for project decisions, file inventory, and Phase 2 considerations.
3. Run `npm install` to restore `node_modules` (gitignored).

**Then ask the user which track to work on.** Two parallel paths exist:

- **Track A — Operational setup (no code).** Get the Supabase project + Brevo SMTP + env vars set up so Phase 1's auth/admin flow actually runs end-to-end. See "Verification" section.
- **Track B — Phase 2 code.** Write `supabase/migrations/0002_domain.sql` and the budgeting/goals/net-worth UI. Before writing the migration, confirm the **open data-model questions** in the "Phase 2 considerations" section with the user. Don't assume.

If the user just says "continue" with no specifics, default to Track B — it's the longer pole. But confirm before writing the migration.

**Hard rules that bit the previous session:**

- Don't write `middleware.ts` — write `proxy.ts` at repo root, export `function proxy(...)`.
- Don't access `cookies()` synchronously — always `await cookies()`.
- Use `@supabase/ssr`'s `getAll`/`setAll` cookie shape; the `get`/`set`/`remove` triple is deprecated.
- Don't add features beyond what the user asks for. The plan has clear scope.
- Don't put model identifiers in commit messages, PR titles/bodies, or code comments.

---

## Project context

**Goal:** a web app for two retirement-age households (parents + in-laws) to do high-level budgeting and net-worth planning. Login frequency is roughly once every 1–2 months. The user (developer) is also the admin.

**Non-negotiables:** free hosting; manual entry only at monthly summary level (no transactions); strict privacy between households; phone + laptop UX optimized for older users; first-run flow must be guided and linear; scales to ~10 households.

### Locked decisions

- **Stack:** Next.js 16 (App Router, TypeScript) on Vercel Hobby; Supabase free tier (Postgres + Auth + RLS); Tailwind + shadcn/ui; Brevo free SMTP (300/day, no domain verification); Server Actions for mutations.
- **Database choice:** Supabase wins for the *Auth*, not the DB — magic links, session refresh, `@supabase/ssr`, admin API, RLS, all bundled. We considered Vercel Postgres, Neon, Turso, D1 — none bundle auth. The 7-day-idle pause is mitigated by a Vercel daily cron heartbeat.
- **Architecture:** SSR + Server Actions hit Supabase via the user's JWT in HttpOnly cookies (`@supabase/ssr`). RLS keyed on `household_members` (many-to-many; profiles are not in a single household). Service-role key is server-only, used solely by admin actions, invite redemption, and the auth webhook.
- **Auth + privacy:** Magic-link only via Brevo. JWT 1h, refresh-token rotation on, inactivity 90d, absolute time-box 365d (matches 1-2x/month usage). Three layers of audit-log writes: sign-in/out (inline in `/auth/callback` + sign-out route), sensitive mutations (every server action via `logAudit()`), admin actions (same helper, flagged). Admin dashboard at `/admin` gated on `profiles.is_admin = true` flag (not a row in `household_members`).
- **RLS policy template:** every household-scoped table uses `is_member_of(household_id) OR is_admin()`. Helper functions are `security definer` so policy checks don't recurse through their own table's RLS.

### Data model (partial — domain section still in draft)

- **Identity / access (locked):** `profiles`, `households`, `household_members(role enum: owner/viewer/accountant)`, `household_invites(token_hash, expires_at, consumed_at, …)`.
- **Audit (locked):** `audit_log` with action_type, actor, household, target, metadata, IP, UA. Admin-read-only RLS.
- **Domain — assets & liabilities (drafted):** `accounts(type enum: checking/savings/investment/retirement/credit_card/mortgage/loan/other, is_liability boolean, current_balance_cents)`; `account_snapshots(account_id, balance_cents, snapshot_date)`. Net worth = `SUM(assets) − SUM(liabilities)`.
- **Domain — budgeting (drafted):** `budget_categories` (expense only) + `category_actuals(year, month, amount_cents)`; mirror tables for income: `income_streams` + `income_actuals`. Same shape so monthly-update wizards are symmetric.
- **Domain — goals (drafted):** `goals(name, target_amount_cents, target_date, saved_cents, status, notes)`.

All money is stored as positive `_cents` integers; sign is implied by which table the row lives in.

---

## What Phase 1 delivered

Phase 1 is the multi-tenant security spine: identity, auth, RLS, admin dashboard, deploy pipeline. No domain features. The goal is a verifiable-end-to-end skeleton: "you and one family member can each sign in, you can see their household from `/admin`, and you can revoke their session."

### File inventory

```
PLAN.html                                     — original project plan document (HTML)
.env.example                                  — required env vars
.gitignore                                    — patched to keep .env.example
.npmrc                                        — pins this project to the public npm registry
vercel.json                                   — daily 09:00 UTC heartbeat cron
proxy.ts                                      — Next 16's renamed middleware
supabase/migrations/0001_init.sql             — identity/access/audit + RLS policies

lib/supabase/server.ts                        — createSupabaseServerClient (getAll/setAll) + admin client
lib/supabase/client.ts                        — createBrowserClient
lib/supabase/proxy.ts                         — updateSession() helper for proxy.ts
lib/audit.ts                                  — logAudit() helper
lib/require-admin.ts                          — defense-in-depth admin gate (called at top of every /admin page)
lib/safe-next.ts                              — sanitises ?next= redirect URLs (open-redirect prevention)

app/layout.tsx                                — root (Geist fonts, base 18px)
app/globals.css                               — base font-size + tap-target minimum
app/page.tsx                                  — redirect("/budget")

app/(auth)/login/page.tsx                     — magic-link UI
app/(auth)/login/login-form.tsx               — client form with useActionState
app/(auth)/login/actions.ts                   — sendMagicLink server action
app/auth/callback/route.ts                    — exchangeCodeForSession + audit sign_in

app/(app)/layout.tsx                          — auth-gated; bottom-tab nav
app/(app)/budget/page.tsx                     — Phase 2 stub
app/(app)/goals/page.tsx                      — Phase 2 stub
app/(app)/net-worth/page.tsx                  — Phase 2 stub
app/(app)/settings/page.tsx                   — shows email + sign-out form
app/(app)/join/page.tsx                       — invite redemption (server-side)
app/(app)/join/join-form.tsx                  — client form component for accepting an invite
app/(app)/join/actions.ts                     — redeemInvite (single-use, calls redeem_invite RPC)

app/(admin)/admin/layout.tsx                  — is_admin gate + tab nav
app/(admin)/admin/page.tsx                    — redirect("/admin/households")
app/(admin)/admin/actions.ts                  — revokeUserSessions, revokeInvite, removeMember
app/(admin)/admin/households/page.tsx         — list households + members; remove
app/(admin)/admin/sessions/page.tsx           — list users; revoke globally
app/(admin)/admin/invites/page.tsx            — list invites; revoke active ones
app/(admin)/admin/audit/page.tsx              — recent-100 audit log viewer

app/api/heartbeat/route.ts                    — SELECT 1 against profiles
app/api/auth/sign-out/route.ts                — POST: audit + signOut + redirect
app/api/webhooks/supabase-auth/route.ts       — stub for future events; HMAC-style shared-secret check
```

### Not yet done in Phase 1

- **Create-household / create-invite UI.** Plan puts these in Phase 2's Settings page. For Phase 1 end-to-end verification, the simplest path is to create the first household + invite via the Supabase SQL editor by hand.
- **Playwright RLS test** (cross-household isolation + admin-route gating). Plan calls for one, blocked on having a real Supabase test project to point at. Add when operational setup is done.

---

## How to verify Phase 1 end-to-end (once operational setup is done)

Order matters — most of these need real Supabase + Brevo creds.

1. **Operational setup** (outside the repo):
   - Create a Supabase project (free, US region).
   - Create a Brevo account, generate SMTP creds, paste into Supabase Auth → SMTP settings.
   - Rewrite the Supabase magic-link email template into plain language.
   - Set session inactivity 90d, absolute time-box 365d in Supabase Auth settings.
   - Apply `supabase/migrations/0001_init.sql` (via Supabase CLI or SQL editor).
   - Copy `.env.example` → `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_WEBHOOK_SECRET` (generate via `openssl rand -hex 32`), `NEXT_PUBLIC_SITE_URL`.
2. `npm run dev`, visit `/login`, request a magic link, confirm it arrives via Brevo and signs you in.
3. In Supabase SQL editor, flip your `profiles.is_admin = true` and insert a `households` row + a `household_members` row for yourself.
4. Visit `/admin` — should see your household + your membership, plus a Sessions tab with your user, plus an empty Invites tab.
5. From SQL editor, insert a row in `household_invites` (token_hash = sha256 of a token you generate; `expires_at = now() + interval '7 days'`). Visit `/join?token=<your-token>` from a logged-out browser → magic-link login → membership row appears, invite marked consumed. Family-member equivalent.
6. From `/admin/sessions`, revoke your own session; confirm next request bounces to `/login` and an `audit_log` row appears.
7. After 24h on Vercel, confirm the cron heartbeat fired (Vercel logs) and Supabase logged the `SELECT 1`.

---

## Phase 2 considerations

Before writing migration `0002_domain.sql` and the budgeting/goals/net-worth UI, confirm with the user:

- Are `(year, month)` integer columns the right key for actuals, or a first-of-month `date`? (Date is more flexible for queries; integers match how non-technical users think.)
- Should `budget_categories` be soft-deletable (`archived_at`) so removing a category mid-year doesn't break historical actuals?
- Initial seed list of ~10 expense categories — confirm vs. let the user choose at onboarding.

Once those are settled, Phase 2 ships these files (per the plan):
- `supabase/migrations/0002_domain.sql`
- `app/(app)/budget/page.tsx` + monthly-update wizard
- `app/(app)/goals/page.tsx` + CRUD
- `app/(app)/net-worth/page.tsx` + monthly-snapshot wizard
- `app/(app)/settings/page.tsx` — accounts + categories + income-streams CRUD + invite-members form
- `app/(app)/onboarding/page.tsx` — first-run guided stepper
- Replace the Phase 2 stub pages with real implementations

---

## Notable decisions / gotchas worth remembering

- **Next 16 renamed middleware → proxy.** File is `proxy.ts` at repo root; function exported as `proxy`. Runtime is Node-only (no Edge). The local `node_modules/next/dist/docs/` is the source of truth — `AGENTS.md` calls this out.
- **`cookies()` is fully async in Next 16.** All server code awaits it.
- **`@supabase/ssr` cookie shape:** use `getAll`/`setAll` (the `get`/`set`/`remove` triple is deprecated). Note that `setAll` now takes a second `headers` argument for cache-control headers — we don't currently set it because Next's response is already non-cached for dynamic routes.
- **Sign-in audit is logged inline in `/auth/callback`,** not via the Supabase Auth webhook. Supabase doesn't expose a clean "after sign-in" hook; the callback is the moment we know who signed in, and it's guaranteed to fire on a successful magic-link exchange. The webhook handler exists as a stub for future events (e.g. user deletion).
- **Invite redemption calls `redeem_invite` RPC with the user-session client, not service-role.** The RPC is `SECURITY DEFINER` and reads `auth.uid()` from the JWT GUC. Using the service-role client would set `auth.uid()` to null and the function would reject every redemption. The RPC itself handles race safety, email binding, expiry, and the `household_members` insert atomically.
- **`household_members` write policy is admin-only.** All non-admin writes happen via service-role server actions (invite redemption, admin "remove member"). This is intentional — a user shouldn't be able to add themselves to an arbitrary household just because they hold an `auth.uid()`.
- **`profiles.is_admin` is pinned in the update policy's `WITH CHECK`** so users can't promote themselves via direct table writes; only the service-role admin client can flip the flag.
- **`(app)` group has no `page.tsx`.** The root `app/page.tsx` redirects to `/budget` inside the group. If you ever add `app/(app)/page.tsx` it'll conflict with the root.
- **`npm run build` triggers a fetch error during page-data collection** when env vars point at a non-existent Supabase host. This doesn't fail the build — all routes get marked ƒ (dynamic) because they `cookies()`. With real env vars in prod, no error.
- **Project `.npmrc`** pins this directory to the public npmjs.org registry. Original session's machine had a corporate registry global config that broke installs; the project-level override insulates this repo.
- **`safeNext()` blocks open redirect on `?next=` parameters.** Any user-controlled `next` value (e.g. the post-login redirect in `/login?next=…`) is validated against an allowlist regex before use. Anything that fails — `//evil.com`, `/%2f%2f…`, absolute URLs, CR/LF injection — falls back to `/`. Lives in `lib/safe-next.ts`.
- **`requireAdminOrRedirect()` is a defense-in-depth admin gate.** Every `/admin/*` page calls it at the top of the RSC, in addition to the shared `(admin)/admin/layout.tsx` check. A future regression in the layout won't silently expose admin data. Lives in `lib/require-admin.ts`.
- **`removeMember` is atomic via a Postgres RPC** (`remove_member`) to avoid a TOCTOU race. A naïve app-side "count owners, then delete" is racy when two admins remove two different owners of the same household concurrently — both pass the count, both delete, household ends up ownerless. The RPC does the last-owner check and delete in a single transaction and raises a constraint violation (`23514`) if it would orphan the household.
