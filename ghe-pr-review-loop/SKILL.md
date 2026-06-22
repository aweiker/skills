---
name: ghe-pr-review-loop
description: "Run GitHub Enterprise PR review loops: triage bot findings by quality, fix verified actionable defects, reply inline, and halt when finding quality declines. Operates in two modes: orchestrator (spawns a background worker pi process) and worker (performs the actual review-fix loop). Use when asked to spawn GHE PR reviews, run PR-bot review loops, or handle repeated review-bot feedback on a GHE PR."
allowed-tools:
  - Bash(gh api *)
  - Bash(gh pr view *)
  - Bash(git status *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push *)
  - Bash(git rev-parse *)
  - Bash(nohup pi *)
  - Bash(jq *)
  - Bash(pgrep *)
  - Bash(pkill *)
  - Bash(python3 *)
  - Bash(cat *)
  - Bash(tail *)
  - Bash(echo *)
---

# GHE PR Review Loop

## Mode Selection (Mandatory)

- If the user prompt contains `worker mode`: jump directly to Worker Mode — do not spawn another pi instance.
- Otherwise: use Orchestrator Mode — do not perform coding/review-fix work in the current session.

## Anti-Patterns

**NEVER trigger a new review when unaddressed root inline comments exist.** The bot re-fires on the
same threads, creating duplicate comments on already-addressed work. Preflight must gate this.

**NEVER wait for CI to finish before posting inline replies.** Post all replies immediately after
push — actionable findings with `CI: pending`, non-actionable findings right after classification.
Holding replies until CI completes delays reviewer visibility and wastes tokens in the CI poll loop
before anyone can act on the result.

**NEVER use `--force-with-lease` on a commit that was never pushed.** On a local-only commit it
behaves like a normal push but sets a misleading pattern in branch history. Use it only when
amending an already-pushed review-fix commit.

**NEVER post a reply to a comment ID without checking `REPLIED_LOG` first.** The worker processes
findings in two phases (non-actionable before push, actionable after push) and may re-encounter
the same comment ID during verification or the next round's preflight. Always `grep -qx
"$COMMENT_ID" "$REPLIED_LOG"` before calling the replies API endpoint. If the ID is already in
the ledger, skip it. This prevents duplicate/contradictory replies within a round and across
rounds.

**NEVER treat the PR-Bot control-panel comment as an approval signal.** It always contains words
that match approval patterns (e.g. "Review"). Matching against it produces false positives on every
run. The preflight jq explicitly excludes comments containing "PR-Bot Control-Panel".

**NEVER post multiple `/review` trigger comments in rapid succession.** One `/review` comment per
round is sufficient. Posting duplicates before the bot responds wastes API calls and may confuse
the bot into producing duplicate review passes.

**NEVER rely on GitHub's formal `APPROVED` review state as the approval gate.** This workflow uses
comment-based approval signals only. Formal review state can lag, be stale, or come from a
different head. Use `jq` to match comment text against the current head epoch instead.

**NEVER enter an unbounded retry loop to appease the bot.** If the bot repeats an already-rebutted
false positive, reply with evidence — do not churn code. Stop after the requested loop count, and
never exceed 8 rounds regardless of loop count or "until clean" mode.

**NEVER continue when finding quality is severely declining.** Each finding is scored by quality
(1.0 = actionable defect, 0.7 = cleanup, 0.3 = out of scope, 0.0 = false positive). Two gates
enforce this:

1. **Post-triage gate (within a round):** After triaging all findings but BEFORE any fix work,
   check the round's average. If all findings scored ≤0.3, or the round average is ≤0.5, stop
   immediately — reply to non-actionable findings and write HANDOFF. Do not fix, push, or
   re-trigger. This prevents fixing low-value suggestions that invite more low-value suggestions.

2. **Round-over-round gate (between rounds):** If the previous round's avg_quality dropped by
   more than 0.4 vs the round before it, do not start the next round.

**NEVER silently act on scope-creep findings.** A finding that would expand the diff beyond its
current file set, refactor adjacent code, or address a systemic issue belongs in a separate PR.
Flag it in HANDOFF as a human decision — do not file it quietly as a follow-up issue and move on.

**NEVER act on a reviewer comment without first reading the cited code.** The bot makes factual
errors — wrong file, stale line, misread context. Every comment must be triaged against the actual
worktree before any fix work begins. Unverified or contradicted claims are false positives.

**NEVER spawn a second worker from inside a worker session.** If both orchestrator and worker
instructions are present, worker mode wins unconditionally.

## Required Inputs

Auto-detect these — do not ask the user:

| Variable | How to derive |
| --- | --- |
| `WORKTREE` | Current working directory |
| `PR` | `gh pr view --json number` |
| `OWNER_REPO` | `gh pr view --json headRepository` or parse from git remote |
| `GHE_API` | `git remote get-url origin \| sed 's|/[^/]*\.git$||; s|/[^/]*$||'` then append `/api/v3` |
| `SESSION_ID` | Generate as `ghe-pr-review-loop-<PR>-<timestamp>` |
| `LOG` | `/tmp/<SESSION_ID>.log` |
| `HANDOFF` | `/tmp/<SESSION_ID>-handoff.md` |

## Loop Count

Default loop count is **5** (thorough). Use it unless the user's prompt explicitly specifies a
different number or mode. Recognized overrides:

| User says (examples) | Loop count |
| --- | --- |
| "single pass", "1 round", "once" | 1 |
| "standard", "3 rounds" | 3 |
| "thorough", "5 rounds" (or nothing — default) | 5 |
| "until clean", "until approved", "keep going" | until clean (max 8) |

Do **not** prompt the user for loop count. Infer from context or use the default.

Never print credential-bearing remote URLs.

## Orchestrator Mode

**MANDATORY — READ ENTIRE FILE**: Load `references/orchestrator-launch.md` now. It contains the
safety rehydrate commands, worker spawn commands (including how to detect the correct PID), launch
status format, status check commands, and cancellation procedure.

**Do NOT load** `references/worker-mode.md` in orchestrator mode — it is only needed by the worker
session.

## Worker Mode

**MANDATORY — READ ENTIRE FILE**: Load `references/worker-mode.md` now. It contains the full
rehydrate/preflight/trigger/wait/classify/fix/push/CI/reply/handoff procedure with working shell
and jq.

**Do NOT load** `references/worker-prompt-template.md` in worker mode — it is only needed by the
orchestrator when building the prompt file.

**Do NOT load** `references/orchestrator-launch.md` in worker mode.
