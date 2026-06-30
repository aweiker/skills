---
name: claude-code-review
description: Run a non-interactive Claude Code review of the current repository, PR, branch diff, or selected files, capturing findings to an untracked claude-review.md file. Use when the user asks for a Claude review, secondary review, external model review, or wants Claude Code to inspect code without modifying it.
---

# Claude Code Review

Use this skill when the user asks to run a Claude Code review of a codebase, branch, PR, diff, or selected files.

The goal is to get an independent review from the installed `claude` CLI while keeping the current agent in control of edits, commits, and follow-up decisions.

## Safety rules

- Do not allow Claude Code to edit files during the review.
- Capture review output to a local untracked file, normally `claude-review.md`.
- Do not commit `claude-review.md` unless the user explicitly asks.
- Do not merge or close PRs/issues based on the review without explicit user instruction.
- Treat Claude findings as review input, not automatically-correct truth.
- Summarize findings for the user and ask before making patches unless the user already requested fixes.
- If the repository has project-specific agent instructions, tell Claude to follow them.
- Avoid printing secrets, credentials, raw upstream payloads, or large sensitive logs in the prompt or output.

## Preflight

1. Confirm the CLI exists:

   ```bash
   command -v claude && claude --version
   ```

2. Inspect local state:

   ```bash
   git status --short
   git branch --show-current
   ```

3. If there are unrelated local modifications, mention them to the user before running a broad review.

## Standard PR/branch review command

From the repository root, run a non-interactive review and write it to `claude-review.md`:

```bash
claude -p "$(cat <<'PROMPT'
You are performing a read-only code review of this repository/branch.

Instructions:
- Do not modify files.
- Review the current branch diff against main and relevant surrounding code.
- Follow repository instructions in AGENTS.md or equivalent files.
- Focus on correctness, contract/schema consistency, security/privacy, fail-closed behavior, test coverage, maintainability, and acceptance criteria.
- For each finding, include severity, file/line if possible, why it matters, and a concrete recommended fix.
- Distinguish blocking issues from optional polish.
- If no blocking issues are found, say so clearly.
- Do not include secrets, raw payload mirrors, or large logs.
PROMPT
)" > claude-review.md
```

If the repo default branch is not `main`, adapt the prompt accordingly.

## PR-specific review command

If a PR number is known, include it in the prompt:

```bash
PR_NUMBER=<number>
claude -p "$(cat <<PROMPT
You are performing a read-only code review for PR #${PR_NUMBER} in this repository.

Instructions:
- Do not modify files.
- Review PR #${PR_NUMBER}, the current branch diff against main, and relevant surrounding code.
- Follow repository instructions in AGENTS.md or equivalent files.
- Focus on correctness, contract/schema consistency, security/privacy, fail-closed behavior, test coverage, maintainability, and acceptance criteria.
- For each finding, include severity, file/line if possible, why it matters, and a concrete recommended fix.
- Distinguish blocking issues from optional polish.
- If no blocking issues are found, say so clearly.
- Do not include secrets, raw payload mirrors, or large logs.
PROMPT
)" > claude-review.md
```

## Optional stricter read-only invocation

When the environment supports Claude Code tool restrictions reliably, prefer a read-oriented invocation. If it fails due to tool naming or permission behavior, fall back to the standard command above and keep the prompt's no-edit instruction.

```bash
claude \
  --permission-mode plan \
  --disallowedTools Edit Write NotebookEdit MultiEdit \
  -p "<review prompt>" > claude-review.md
```

## After running

1. Read the review output:

   ```bash
   # Use the read tool in pi, not cat, when available.
   ```

2. Summarize findings as:

   - Blocking / should address now
   - Non-blocking polish
   - False positives or already-covered behavior
   - Suggested next action

3. If fixes are requested or clearly required:

   - Map each finding to the missing design rule/test.
   - Add or update tests before production patches when practical.
   - Run the project's canonical gate after fixes.
   - Rerun Claude review only when useful.

4. Leave `claude-review.md` untracked unless explicitly told otherwise.

## Review prompt variants

### Contract/schema review

Use for Pydantic models, JSON schemas, API contracts, config loaders, and typed boundaries:

```text
Focus especially on contract consistency between runtime validation, JSON Schema, docs, examples, fixtures, and loader behavior. Look for paths that bypass validation, coercion surprises, unknown fields, duplicated/ambiguous config, bounded-size gaps, and missing negative tests.
```

### Security/privacy review

Use for API, persistence, collector/destination boundary, logging, and source-payload handling:

```text
Focus especially on OWASP-informed fail-closed behavior, authorization seams, injection/SSRF risks, bounded diagnostics, secret/raw-payload leakage, destination-side source access, unsafe logging, and negative tests for malformed or malicious inputs.
```

### Thin-route/API review

Use for FastAPI route, dependency, or response model changes:

```text
Focus especially on typed request dependencies, centralized bounded error handling, explicit response models, route thinness, request/response validation, and whether malformed internal payloads can bypass response contracts.
```
