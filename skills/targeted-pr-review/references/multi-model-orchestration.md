# Multi-model review orchestration

Use multiple models as independent reviewers, not as a majority vote. A finding is real if it can be verified against code, tests, docs, or a local reproduction, even if only one model finds it.

## Spend modes

Choose the smallest mode that matches risk.

| Mode | Use when | Context | Passes | Models |
|---|---|---|---|---|
| `triage` | User asks whether comments are real; small follow-up PR; low-risk docs/tooling | PR comments + specific files | 1 synthesis pass | current agent only |
| `light` | Small diff, low-risk implementation, no state/security/API boundary | root instructions + top 3 docs + diff summary | 1-2 focused passes | one external model max |
| `standard` | Normal PR touching API, config, UI, persistence, or tests | root instructions + PR/issue + top 5-8 docs + changed files | 3-5 passes | one primary external model, optional second on high-risk pass |
| `deep` | Stateful, security, auth, persistence, migrations, money/trading, cross-boundary architecture, large refactor | root instructions + PR/issue + top 8-12 docs + surrounding code/tests | 5-8 passes | Claude + Codex independent passes |
| `surgical` | One suspicious invariant or reviewer finding | only docs/files needed for that invariant | 1 focused pass | whichever model is strongest for that concern |

Default to `standard` for code-changing PR review. Escalate to `deep` only when the diff or docs indicate high risk.

## Escalation triggers

Escalate one level when any of these are present:

- authentication, authorization, credentials, tokens, secrets;
- source/destination or tenant boundary;
- persistence, migrations, replay, backfill, retention;
- state machines, lifecycle gates, fail-closed behavior, retries/idempotency;
- public API/schema/contract changes;
- money/trading/order placement, compliance, legal/license risk;
- large diff (rough guide: >20 files or >800 changed lines);
- new dependency ecosystem or build/CI changes;
- prior reviewer has requested changes.

De-escalate one level when:

- docs-only or formatting-only;
- isolated test-only change;
- small mechanical rename with no public contract change;
- user asks for quick triage only.

## Token/context controls

1. Never paste the whole repository.
2. Use the discovery context as an index, not a full context dump.
3. Read docs progressively:
   - `light`: top 3 relevant docs;
   - `standard`: top 5-8 relevant docs;
   - `deep`: top 8-12 relevant docs plus cross-references.
4. Prefer focused prompts over broad prompts.
5. Limit each model pass to one dimension.
6. Do not run both models on every pass by default.
7. Use Codex/Claude output files as artifacts; summarize, do not re-feed all outputs verbatim unless synthesizing.
8. Rerun only affected passes after fixes.
9. For large generated files/lockfiles, inspect metadata/scripts and targeted snippets unless the review dimension is specifically supply-chain/reproducibility.
10. For vendored deps/build dirs/virtualenvs, ignore by default.

## Model allocation guidance

These are heuristics, not rules.

### Claude

Often useful for:

- architecture and design-doc consistency;
- fail-closed/lifecycle reasoning;
- security/privacy boundary review;
- acceptance-criteria and scope review;
- explaining tradeoffs.

### Codex

Often useful for:

- concrete code-path edge cases;
- language/tooling behavior;
- type and API contract pitfalls;
- test gaps and repro snippets;
- build/CI/package issues.

### Current agent

Always responsible for:

- selecting context;
- keeping models independent;
- verifying findings locally;
- deduplicating and classifying findings;
- deciding fixes/defer/pushback with repo instructions.

## Independence rule

Run model passes independently before synthesis.

Do not show Claude's findings to Codex, or Codex's findings to Claude, until after both have completed their independent passes. This reduces anchoring and produces more diverse failure modes.

## Artifact layout

Use untracked artifacts:

```text
.targeted-review/
  context.md
  plan.md
  claude/
    01-security.md
    02-contracts.md
  codex/
    01-security.md
    02-contracts.md
  synthesis.md
```

If repo-local artifacts are undesirable, use `/tmp/targeted-review-<repo>-<pr>/`.

## Claude command pattern

```bash
mkdir -p .targeted-review/claude
claude --tools "Bash,Read" --permission-mode plan -p "$(cat <<'PROMPT'
You are performing one focused, read-only review pass for this repository/branch.

[focused prompt]
PROMPT
)" > .targeted-review/claude/01-pass-name.md
```

`--tools "Bash,Read"` is an allowlist — only those tools are available. This is safer than a
deny list (`--disallowedTools`) because new tools added in future Claude Code versions are
automatically excluded, and there are no tool-name typo risks.

If tool restrictions fail in the local environment, fall back to a clear read-only prompt and keep artifacts untracked.

## Codex command patterns

Prefer Codex's built-in review mode when a branch/base diff is enough:

```bash
mkdir -p .targeted-review/codex
codex review --base origin/main - <<'PROMPT' > .targeted-review/codex/01-pass-name.md
You are performing one focused, read-only review pass.

[focused prompt]
PROMPT
```

For more custom instructions or when you need sandbox enforcement, use exec with read-only sandbox:

```bash
mkdir -p .targeted-review/codex
codex exec --sandbox read-only --cd "$PWD" - <<'PROMPT' > .targeted-review/codex/01-pass-name.md
You are performing one focused, read-only review pass.
Do not modify files. Review the current branch against origin/main.

[focused prompt]
PROMPT
```

Use `--ephemeral` if available/appropriate to reduce session persistence:

```bash
codex exec --ephemeral --sandbox read-only --cd "$PWD" - <<'PROMPT'
...
PROMPT
```

## Synthesis protocol

After all selected passes finish:

1. Read each output once.
2. Extract findings into a table:

   ```markdown
   | Finding | Model/pass | Real? | Severity | Evidence/repro | Missing test | Action |
   |---|---|---:|---:|---|---|---|
   ```

3. Verify suspicious findings directly with code inspection, a small local repro, or tests.
4. Do not count votes. Mark a finding real if verified.
5. Group duplicates by violated invariant.
6. Identify which focused pass should be rerun after fixes.

## Suggested default combinations

### Standard PR

- Claude: architecture/security or scope pass.
- Codex: code-path/test-gap pass.
- Current agent: synthesis and local verification.

### Security/API boundary PR

- Claude: security/privacy/ownership pass.
- Codex: concrete bypass and contract edge-case pass.
- Current agent: reproduce bypasses and map to tests.

### Tooling/dependency PR

- Codex: tooling/license/CI pass.
- Claude: scope/docs/developer-workflow pass.
- Current agent: run targeted commands or minimal repros.

### Stateful lifecycle PR

- Claude: state-machine/fail-closed pass.
- Codex: race/order/idempotency/test-gap pass.
- Current agent: build state-transition matrix and verify tests.
