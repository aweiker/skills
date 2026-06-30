---
name: coderabbit-pr-review-loop
description: "Compatibility shim for CodeRabbit PR review loops. Prefer ai-pr-review-loop; this skill delegates to the unified provider model with provider=coderabbit. Use when existing prompts explicitly name coderabbit-pr-review-loop or CodeRabbit feedback."
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

# CodeRabbit PR Review Loop Compatibility Shim

This provider-specific skill is no longer the source of truth.

## Mandatory delegation

Use the sibling `../ai-pr-review-loop` skill with provider `coderabbit`.

- If this session is in orchestrator mode, load `../ai-pr-review-loop/SKILL.md`, select provider `coderabbit`, then follow its Orchestrator Mode.
- If this session is in worker mode, load `../ai-pr-review-loop/SKILL.md`, `../ai-pr-review-loop/references/worker-mode.md`, and `../ai-pr-review-loop/references/providers/coderabbit.md`, then follow the unified Worker Mode.

Do not load this directory's old `references/` files unless you are deliberately auditing historical behavior. They are retained temporarily for comparison only and must not be edited as the canonical workflow.
