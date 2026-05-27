# ROUTINES.md

This repo has a fleet of Claude Code routines running autonomously in the background.
If you are a Claude agent working in this repo interactively with the user, read this
before suggesting any action that touches GitHub issues, PRs, or labels.

---

## What the fleet does

Five routines run on Anthropic's cloud infrastructure. They coordinate via GitHub labels.
You do not need to trigger them — they fire on their own. Your job is to work with the
user without stepping on them.

| Routine | Trigger | What it does |
|---|---|---|
| **PM** | Monday 08:00 or manual `/fire` | Finds `needs-spec` issues, writes full specs, flips label to `ready-to-build` |
| **Coder** | Issue labeled `ready-to-build` | Implements the spec, opens a PR labeled `needs-design-review` |
| **Designer** | PR labeled `needs-design-review` | Reviews UI/UX for older-user accessibility, posts inline comments |
| **Reviewer** | PR opened | Reviews for correctness and architecture, posts inline comments |
| **Docs Writer** | PR merged to main | Updates HANDOFF.md, CHANGELOG.md, and inline docs |
| **Release Notes** | GitHub release created | Rewrites the release body in plain language for non-technical readers |

---

## Label conventions

These labels are the handoff signals between routines. Do not add or remove them
unless you understand the downstream effect.

| Label | Meaning | Who sets it | Who consumes it |
|---|---|---|---|
| `needs-spec` | Idea exists, no spec yet | User or you | PM routine |
| `ready-to-build` | Spec written, approved | PM routine | Coder routine |
| `in-progress` | Coder is working on it | Coder routine | — (prevents double-pickup) |
| `needs-design-review` | PR opened, needs UX review | Coder routine | Designer routine |
| `design-approved` | Designer signed off | Designer routine | User / Reviewer |

---

## How to work alongside the fleet

### When the user asks you to build a feature

Do not just start coding. Ask:

1. Does an issue already exist for this?
2. If yes — does it have a spec (`ready-to-build` label)? If so, the Coder routine
   will pick it up on its own. Ask the user if they want the routine to handle it
   or if they want you to implement it now interactively.
3. If no issue exists — offer to create one with `needs-spec` so the PM routine
   specs it out first, OR ask the user if they want to skip the pipeline and build
   it directly with you right now.

**Default posture:** pipeline for non-urgent work, interactive for anything the user
wants done immediately or wants to think through together.

### When the user wants to steer product direction

This is your job, not the PM routine's. The PM routine writes specs for issues that
already exist — it does not decide what to build. Help the user think through
priorities, tradeoffs, and sequencing. Then, once a decision is made, create the
issue with `needs-spec` to hand it to the pipeline.

### When a PR is open

Do not push commits to an open PR unless the user explicitly asks. The Reviewer and
Designer routines may still be running. If you need to fix something, tell the user
what to change and let them decide whether to push or let the Coder routine handle it.

### When you create issues

Follow this format so the PM routine can process them cleanly:

```bash
gh issue create \
  --title "<imperative verb> <what>" \
  --body "TBD" \
  --label "needs-spec"
```

Body can be a one-liner or TBD — the PM routine fills it in. Do not write a full spec
yourself unless the user asks you to skip the pipeline.

### What not to do

- Do not remove `in-progress` from an issue unless you are certain the Coder routine
  has abandoned the run (check recent runs at claude.ai/code/routines first).
- Do not push directly to main. All changes go through PRs.
- Do not add model identifiers to commit messages, PR titles, PR bodies, issue text,
  or code comments.
- Do not merge PRs. The user merges.

---

## Manually triggering a routine

If the user wants to kick off a routine out of cycle:

**PM routine** — fire via the API trigger at claude.ai/code/routines, or:
- Add `needs-spec` to any issue and it will run on the next Monday schedule.

**Coder routine** — remove and re-add `ready-to-build` on the target issue:
```bash
gh issue edit <number> --remove-label "ready-to-build"
gh issue edit <number> --add-label "ready-to-build"
```

**Designer routine** — remove and re-add `needs-design-review` on the target PR:
```bash
gh pr edit <number> --remove-label "needs-design-review"
gh pr edit <number> --add-label "needs-design-review"
```

**Docs Writer / Release Notes** — these fire on merge and release events.
Cannot be meaningfully re-triggered manually; just let them run naturally.

---

## Where to check routine status

- Recent runs and logs: `claude.ai/code/routines`
- Whether a routine fired: check the issue/PR for comments or label changes
- Quota usage: visible on the routines dashboard — on busy days, events beyond
  the cap are dropped silently

---

## Relation to AGENTS.md

`AGENTS.md` covers Next.js 16 and framework-level rules for any agent writing code
in this repo. `ROUTINES.md` (this file) covers the autonomous fleet running in the
background. Read both before starting work.
