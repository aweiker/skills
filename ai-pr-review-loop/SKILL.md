---
name: ai-pr-review-loop
description: "Run AI PR review loops with a provider model for bot-specific behavior. Supports CodeRabbit on public GitHub and Hyperspace/PR-Bot on GitHub Enterprise: preflight existing inline threads, trigger reviews only when safe, triage AI comments by quality, fix verified actionable defects, reply inline, and halt when findings are clean or quality declines. Operates in orchestrator and worker mode. Use for CodeRabbit feedback, GHE/Hyperspace PR-bot feedback, repeated AI PR comments, or generic AI reviewer loop requests."
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

<!-- markdownlint-disable MD013 -->

# AI PR Review Loop

One loop, provider-specific PR/comment semantics.

## Mode Selection (Mandatory)

- If the user prompt contains `worker mode`: jump directly to Worker Mode — do not spawn another pi instance.
- Otherwise: use Orchestrator Mode — do not perform coding/review-fix work in the current session.

## Provider Selection (Mandatory)

Select exactly one provider before loading workflow references:

| Provider     | Use when                                                                                            | Provider file                        |
| ------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `coderabbit` | Public GitHub PRs reviewed by CodeRabbit, `@coderabbitai review`, CodeRabbit inline/review comments | `references/providers/coderabbit.md` |
| `ghe-pr-bot` | GitHub Enterprise PRs reviewed by Hyperspace/PR-Bot, `/review`, GHE API/comment semantics           | `references/providers/ghe-pr-bot.md` |

Selection rules:

1. If the user says CodeRabbit, coderabbit, or public GitHub CodeRabbit: provider is `coderabbit`.
2. If the user says GHE, GitHub Enterprise, Hyperspace, PR-Bot, or review-bot: provider is `ghe-pr-bot`.
3. Otherwise infer from `gh pr view` and git remote host:
   - `github.com` with CodeRabbit comments/status checks → `coderabbit`.
   - `github.concur.com` or Enterprise API URL → `ghe-pr-bot`.
4. If both are plausible, ask one focused question. Do not guess.

## Anti-Patterns

**NEVER duplicate provider logic in multiple skills.** This skill is the canonical workflow. Old provider-named skills are compatibility shims only.

**NEVER trigger a new review when unresolved inline threads exist.** Provider preflight decides what "unresolved" means. Triggering early creates duplicate bot comments.

**NEVER treat "we replied" as resolution if the bot replied after us.** Provider rules must inspect latest thread reply and classify bot pushback before any new trigger.

**NEVER wait for CI before posting inline replies.** Reply immediately after classification for non-actionable findings and immediately after push for fixed findings with `CI: pending`.

**NEVER rely on stale formal review state.** Provider rules must tie approval/no-actionable signals to the current head or current-head epoch.

**NEVER enter an unbounded appeasement loop.** Stop after requested loop count, max 8. Stop earlier if quality declines.

**NEVER act on an AI comment without reading cited code.** AI reviewers hallucinate stale lines and wrong invariants. Verify every finding against the worktree first.

**NEVER silently defer scope creep.** A finding that expands the PR beyond its intended diff is out of scope unless the user explicitly approves a follow-up issue/PR.

**NEVER spawn a second worker from worker mode.** Worker mode always wins if both mode instructions are present.

**NEVER print credential-bearing remote URLs.** Strip credentials from any remote output.

## Required Inputs

Auto-detect these — do not ask the user unless detection conflicts:

| Variable     | How to derive                                                                         |
| ------------ | ------------------------------------------------------------------------------------- |
| `WORKTREE`   | Current working directory                                                             |
| `PR`         | `gh pr view --json number`                                                            |
| `OWNER_REPO` | `gh pr view --json headRepository` or parse from git remote                           |
| `PROVIDER`   | Provider Selection table above                                                        |
| `API_BASE`   | Provider file (`https://api.github.com` for CodeRabbit; Enterprise `/api/v3` for GHE) |
| `SESSION_ID` | `ai-pr-review-loop-<provider>-<PR>-<timestamp>`                                       |
| `LOG`        | `/tmp/<SESSION_ID>.log`                                                               |
| `HANDOFF`    | `/tmp/<SESSION_ID>-handoff.md`                                                        |

## Loop Count

Default loop count is **5**. Use it unless the user explicitly specifies a different mode.

| User says                                     | Loop count         |
| --------------------------------------------- | ------------------ |
| "single pass", "1 round", "once"              | 1                  |
| "standard", "3 rounds"                        | 3                  |
| "thorough", "5 rounds", or unspecified        | 5                  |
| "until clean", "until approved", "keep going" | until clean, max 8 |

## Orchestrator Mode

**MANDATORY — READ ENTIRE FILE**: Load `references/orchestrator-launch.md`.

Then load the selected provider file from `references/providers/` and use its values when filling the worker prompt.

**Do NOT load** `references/worker-mode.md` in orchestrator mode.

## Worker Mode

**MANDATORY — READ ENTIRE FILES**:

1. `references/worker-mode.md`
2. The selected provider file from `references/providers/`

**Do NOT load** `references/worker-prompt-template.md` in worker mode — it is only needed by the orchestrator.
