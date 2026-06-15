---
name: targeted-pr-review
description: Dynamically plan and run multiple focused read-only PR/branch reviews by scanning the repo, discovering relevant design docs, mapping them to the diff, and generating just-in-time review dimensions. Use when asked for targeted reviews, holistic self-review, review planning, or to identify real PR comments before fixing.
---

# Targeted PR Review

Use this skill when the user asks for a targeted, holistic, or multi-pass review of a PR, branch, diff, or review comments.

The goal is to avoid a single broad review that misses specialized issues. First discover repository instructions, design docs, implementation docs, plans, and changed files dynamically. Then generate focused review passes just in time from the discovered context. For important PRs, incorporate multiple independent model perspectives (for example Claude and Codex) without treating consensus as truth.

## Safety rules

- Reviews are read-only unless the user explicitly asks to fix findings.
- Do not commit review artifacts unless explicitly requested.
- Treat model/reviewer findings as inputs to triage, not automatically true.
- Do not paste secrets, credentials, raw upstream payloads, or large logs into prompts or outputs.
- Do not hard-code one repository's current design-doc file list into the review. Always rediscover docs at review time.
- Prefer project validation commands from repository instructions/Makefile when later fixing findings.
- Control token/model spend deliberately. Choose a spend mode before invoking external models, and escalate only when risk justifies it.
- Keep multi-model reviews independent until synthesis; do not feed one model's findings to another before both have reviewed.

## Workflow

### 1. Preflight

From the repository or worktree under review:

1. Inspect state:

   ```bash
   git status --short
   git branch --show-current
   ```

2. Identify whether the user wants:
   - plan only;
   - run focused reviews;
   - triage existing PR comments;
   - fix findings after triage.

3. If unrelated local modifications exist, mention them before running broad reviews.
4. Check available review engines when multi-model review is requested or useful:

   ```bash
   command -v claude && claude --version
   command -v codex && codex --help | head
   ```

### 2. Dynamic holistic intake

Run the discovery script from the repo root or any subdirectory:

```bash
mkdir -p .targeted-review
~/.pi/agent/skills/targeted-pr-review/scripts/discover-review-context.sh > .targeted-review/context.md
```

Optionally pass a base ref:

```bash
mkdir -p .targeted-review
~/.pi/agent/skills/targeted-pr-review/scripts/discover-review-context.sh origin/master > .targeted-review/context.md
```

Then read `.targeted-review/context.md` with the read tool.

The script dynamically discovers:

- repository root, branch, and base ref;
- changed files from branch diff or working tree;
- root instruction files if present;
- markdown design/context docs across the repo;
- keywords from changed paths and branch name;
- ranked relevant docs using generic design-doc locations/names plus path/content keyword matches;
- suggested focused review dimensions.

Important: this is a ranking aid, not a substitute for judgment. Follow cross-references in selected docs when relevant.

### 3. Read the source pack

Read, in this order:

1. Root instruction files discovered by the script.
2. PR/issue body if the user provided or if available via `gh pr view`.
3. Top-ranked docs from `.targeted-review/context.md` until you can state the key invariants.
4. The changed files and nearby surrounding code.
5. Existing tests around changed behavior.

Do not assume a fixed docs layout. If docs moved or new plans were added, use the discovered/ranked files.

### 4. Choose spend mode and generate focused review plan

Load `references/multi-model-orchestration.md` before selecting external model passes.

Choose one spend mode:

- `triage` — current-agent review only, for PR comment triage or very small changes.
- `light` — one external model, one or two passes.
- `standard` — normal code PR; one primary external model plus optional second model for high-risk areas.
- `deep` — high-risk state/security/API/persistence/migration/money/compliance changes; Claude + Codex independent passes.
- `surgical` — one suspicious invariant or reviewer finding.

Before running model reviews or doing manual triage, produce a short plan:

```markdown
## Targeted review plan

### Context sources read
- ...

### Invariants inferred from docs/code
- ...

### Spend mode
- Mode: ...
- Why this mode is sufficient:
- Escalation triggers present:
- Token controls:

### Focused review passes
1. ... — why this pass is needed — engine: current/claude/codex
2. ... — why this pass is needed — engine: current/claude/codex

### Passes intentionally skipped
- ... — why safe to skip
```

Choose review passes from the dynamic script output and the docs you read. Always include a test-gap pass for non-trivial code changes.

### 5. Focused review prompt templates

Load `references/focused-review-prompts.md` for reusable prompts. Adapt prompts to the current repo, selected docs, and changed files.

For each pass, keep the prompt narrow. Examples:

- Only state machine/fail-closed behavior.
- Only OTP/GenServer responsiveness and process ownership.
- Only API contract/idempotency compatibility.
- Only security/privacy/ownership boundaries.
- Only config/topology/dependency propagation.
- Only persistence/replay consistency.
- Only test gaps vs docs and PR claims.

### 6. Optional external model execution

If the user wants external model review and `claude` and/or `codex` are available, run one output file per pass. Keep artifacts untracked.

Use multiple models for different lenses, not duplicated broad reviews. A common `standard` allocation is:

- Claude: architecture/security/scope pass.
- Codex: concrete code-path/test-gap/tooling pass.
- Current agent: local verification and synthesis.

Use `deep` only when the risk justifies the spend.

Recommended artifact directory:

```bash
mkdir -p .targeted-review
```

Example command shape:

```bash
mkdir -p .targeted-review/claude
claude -p "$(cat <<'PROMPT'
You are performing one focused, read-only review pass for this repository/branch.

[Insert adapted focused prompt here.]
PROMPT
)" > .targeted-review/claude/01-state-machine.md
```

Use separate files such as:

- `.targeted-review/claude/01-state-machine.md`
- `.targeted-review/claude/02-security-ownership.md`
- `.targeted-review/codex/01-contract-idempotency.md`
- `.targeted-review/codex/02-test-gaps.md`

Do not commit `.targeted-review/` unless explicitly asked.

For Codex, prefer one of these patterns:

```bash
codex review --base origin/main - <<'PROMPT' > .targeted-review/codex/01-pass-name.md
You are performing one focused, read-only review pass.

[focused prompt]
PROMPT
```

or, when sandbox enforcement/custom context is needed:

```bash
codex exec --sandbox read-only --cd "$PWD" - <<'PROMPT' > .targeted-review/codex/01-pass-name.md
You are performing one focused, read-only review pass.
Do not modify files.

[focused prompt]
PROMPT
```

See `references/multi-model-orchestration.md` for spend modes, escalation triggers, and command variants.

### 7. Synthesize and triage findings

Only after independent model passes are complete, combine manual review, external model outputs, and PR comments into one matrix:

```markdown
| Finding | Source/pass | Real? | Severity | Violated invariant | Test needed | Fix/defer/push back |
|---|---|---:|---:|---|---|---|
```

Do not use majority vote. Verify findings directly against code, docs, tests, or a small local repro. A finding can be real even when only one model found it.

Classify each finding:

- **Fix now** — real issue in PR scope.
- **Defer** — valid but out of scope; create/reference issue if appropriate.
- **Push back** — incorrect or harmful suggestion; explain why.
- **Needs human decision** — ambiguous product/domain choice.

### 8. If fixing findings

When the user asks to fix:

1. Map each real finding to a missing design rule/invariant.
2. Add or update tests first when practical.
3. Patch the minimal production code.
4. Run targeted tests and the repository's canonical validation gate.
5. Rerun only the focused passes that correspond to changed risk areas.
6. Remove or leave untracked review artifacts; do not commit them by accident.

## Dynamic discovery principles

- The skill encodes how to discover context, not a static list of design files.
- Design docs can live under any path; rank by path/name/content relevance.
- Issue/PR text, branch names, changed paths, module names, and test names are all signals.
- If the diff touches a layer whose docs are missing, include a documentation/test-gap finding rather than silently reviewing without design context.
- If selected docs contradict code or each other, flag the contradiction as a review finding.

## Outputs

For a plan-only run, output:

- context sources read;
- inferred invariants;
- selected spend mode and why;
- focused review passes to run;
- assigned engine/model for each pass;
- passes skipped to control token spend;
- reason for each pass.

For a completed review, output:

- blocking issues;
- non-blocking polish;
- false positives/pushback;
- needs-human-decision items;
- suggested tests;
- suggested validation commands.
