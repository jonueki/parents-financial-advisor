# Changelog

All notable changes to this project will be documented here.
Written in plain language — these notes may be read by family members someday.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

## [2026-05-27] — Phase 1: accounts, sign-in, and admin tools

### Added

- **Sign-in by magic link.** Family members sign in by entering their email address and clicking a link — no password to remember. Links are sent via email and expire after use.
- **Separate accounts for each household.** Each family is kept completely private from the others. One household cannot see another household's data under any circumstances.
- **Admin dashboard** (`/admin`) for the developer to manage households, view who is signed in, revoke access, manage pending invites, and review a log of security-sensitive actions.
- **Invite-based onboarding.** New family members join by clicking a one-time invite link. The link expires and can only be used once.
- **Automatic keep-alive.** A daily background job pings the database so the free hosting plan doesn't pause after inactivity.
- **Deploy pipeline.** The app is wired up to deploy automatically on Vercel from the main branch.
