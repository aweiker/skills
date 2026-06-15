---
name: design-first-implementation
description: Use at the start of any story, issue, bug fix, feature, PR, or implementation task to decide whether a design/test-first plan is needed. Always evaluate for project work; use the full workflow for stateful, persistence, API, contract, migration, security/privacy, integration, retry/idempotency, or edge-case-heavy changes.
---

# Test-First Design

Prevent happy-path-only implementation by making expected behavior and tests explicit before production code is written. The central discipline: separate what is *stored* from what readers *derive*, and enumerate failure modes deliberately rather than discovering them in review.

## Activation rule

At the start of any story, issue, bug fix, feature, PR, or implementation task, load this skill and perform at least the applicability check below.

Use the full workflow when the work is non-trivial or touches state, persistence, APIs, contracts, schemas, migrations, security/privacy, integrations, retries, idempotency, retention, reconciliation, or edge-case-heavy behavior.

For simple mechanical edits, documentation-only changes, typo fixes, formatting-only changes, or obvious one-line refactors, the full workflow may be skipped only after recording why it is safe to skip.

Minimum required output for every issue/story task:

```markdown
## Test-first design applicability

- Full workflow needed? yes/no
- Reason:
- If no, why safe to skip:
```

## Core rule

Do not start production implementation for non-trivial work until you have produced a design/test plan that identifies:

1. The intended behavior.
2. Existing invariants and constraints.
3. Happy paths.
4. Unhappy paths.
5. State transitions, if applicable.
6. Migration/backfill/compatibility behavior, if applicable.
7. Tests to write or update.
8. Open questions or ambiguous behavior.

If behavior is ambiguous, pause and ask for clarification instead of implementing ad hoc behavior.

## Never

- NEVER conflate persisted state with derived/read-time state. They diverge once time, policy, permissions, or compatibility rules are applied; a test that asserts on one silently passes the other, hiding the bug until production.
- NEVER patch a review finding's local symptom. A finding is evidence of a missing design rule — fix the rule and add a test, or the same class of bug returns elsewhere.
- NEVER let migration-time and runtime classify the same old data differently. Backfill and live reads must agree on what "stale", "missing", or "complete" mean, or rows will flip state on the next write.
- NEVER ship happy-path-only behavior. If an unhappy path is hard to specify, that is a design gap to resolve before coding, not an implementation detail to improvise.
- NEVER skip negative assertions for security/privacy work. "No leakage" and "no forbidden side effect" must be asserted explicitly; their absence is not evidence of their safety.

## Scope

Always evaluate this skill for story/issue work. Use the full workflow when a change is stateful, persistence- or migration-related, contract- or schema-sensitive, security/privacy-sensitive, integration-related, retry/idempotency-related, or likely to have important edge cases. For simple mechanical edits, documentation-only changes, typo fixes, or straightforward refactors, record the applicability check and use a shorter plan or skip the full workflow.

Not every step applies to every change. Use this to route:

| Condition | Required steps |
|---|---|
| Any issue/story/PR implementation | Applicability check |
| Full workflow applies | 1 Goal, 2 Invariants, 3 Happy paths, 4 Unhappy paths, 7 Tests, 8 Implement |
| Stateful / status / freshness logic | + 5 State-transition table |
| Schema or data-shape change | + 6 Migration/backfill rules |
| Review finding arrives mid-work | + 9 Review loop |

## Workflow

### 1. Restate the goal

State the desired behavior, not the code change, plus non-goals and explicitly out-of-scope behavior.

### 2. Identify invariants

List what must stay true across this change. The non-obvious ones to check: data ownership and source of truth, public-contract compatibility, persistence/read-model consistency, idempotency, migration safety, and security/privacy boundaries.

### 3. Define happy paths

List the normal successful cases first, concretely:

```text
Given previous state X
When valid input Y arrives
Then persisted state is A
And read model is B
And no forbidden side effect C occurs
```

### 4. Spend deliberate time on unhappy paths

Actively search for edge cases. Consider at least these categories:

- missing required input;
- partial input;
- invalid input;
- duplicate input;
- conflicting input;
- out-of-order input;
- repeated failures;
- failure after success;
- success after failure;
- stale or expired state;
- empty-but-valid results;
- no-op inputs;
- boundary values;
- malformed payloads;
- unsupported versions;
- unknown identities/references;
- migration from older data shape;
- backfill/reconciliation behavior;
- retention/deletion behavior;
- downstream/upstream unavailability;
- security/privacy leakage;
- idempotency and retry behavior.

If an unhappy path is difficult to specify, treat that as a design problem and ask for clarification. If clarification is not available, record the chosen behavior as an assumption under Open questions and add a test that pins it, so the decision is visible and revisitable rather than implicit.

### 5. Build a state-transition table when stateful

For stateful behavior, create a table before coding.

Template:

```text
| Previous persisted state | Incoming event/input | Expected stored state | Expected read model | Notes/tests |
|---|---|---|---|---|
| none | success | ... | ... | ... |
| none | failure | ... | ... | ... |
| success | failure | ... | ... | ... |
| failure | failure | ... | ... | ... |
| stale | read-only | ... | ... | ... |
```

Important distinction (see Never, rule 1):

- Persisted state is what is stored.
- Derived/read-time state is what readers observe after applying time, policy, permissions, or compatibility rules.

### 6. Define migration/backfill rules when schemas change

For migrations, write semantic upgrade rules, not only schema operations.

Consider:

- existing rows with complete old data;
- existing rows missing optional old data;
- existing rows with partial/inconsistent old data;
- empty tables;
- downgrade behavior, if supported;
- whether runtime behavior and migration behavior classify old data the same way.

### 7. List tests before implementation

Create a test matrix. Each behavior rule should map to at least one test or documented validation step.

Prefer test names that encode behavior:

```text
test_failed_refresh_after_success_preserves_previous_visible_metrics
test_freshness_becomes_stale_at_read_time_without_new_write
test_migration_backfills_metric_bearing_rows_without_state_as_collected
```

For each test, note:

- fixture/setup;
- action;
- expected persisted state;
- expected read model/output;
- negative assertions, especially no leakage or forbidden side effects.

### 8. Implement only against the matrix

After tests are defined, implement the smallest code necessary to satisfy them.

If implementation reveals a new special case:

1. Stop.
2. Add it to the behavior matrix.
3. Add or update a test.
4. Then implement.

### 9. Review loop discipline

When a review finding appears, treat it as evidence of a missing design/test case.

For each finding:

1. Identify the missing rule or invariant.
2. Add it to the matrix.
3. Add or update a test.
4. Then patch code (see Never, rule 2: fix the rule, not just the local symptom).
5. Record the finding in the verification summary.

## Required output format before implementation

**MANDATORY for issue/story work — load `references/templates.md`** and first produce the Test-first design applicability section.

If the full workflow applies, also produce the Design/test plan section before writing production code. If some sections do not apply, say why.

If the full workflow does not apply, record why it is safe to skip before proceeding.

## Implementation gate

Before writing production code, check:

- Are source-of-truth and derived/read-time values separated?
- Are partial and missing inputs specified?
- Are repeated failures specified?
- Are migration semantics specified?
- Are tests named for the behavior, not the implementation?
- Are security/privacy negative assertions included where relevant?

If any answer is no for a relevant category, continue designing before coding.

## Verification summary

When finished, produce the Verification summary from `references/templates.md` (loaded above). **Do NOT load** `references/templates.md` a second time if it is already in context.
