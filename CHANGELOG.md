# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [2026-05-27] — Phase 1: sign-in, households, and admin tools

### Added

- **Sign-in by magic link.** No passwords. You request a link to your email address and it signs you in automatically.
- **Households.** Each family lives in their own private space. Members of one household cannot see anything from another.
- **Invite system.** The admin sends a one-time link to a family member. They click it, confirm, and are added to the household. Links expire after 7 days and can only be used once.
- **Admin dashboard.** The developer can view all households and members, revoke anyone's session, manage pending invites, and read a log of every sensitive action that has happened in the app.
- **Audit log.** Every sign-in, sign-out, invite redemption, and admin action is recorded with a timestamp and the actor's identity.
- **Automatic keep-alive.** The app pings the database once a day so the free-tier database doesn't go to sleep.
- **Stub pages for Phase 2.** Budget, Goals, and Net Worth screens exist but are empty placeholders until Phase 2.
