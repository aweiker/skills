---
name: design-first-implementation
description: "Always load at the start of any story, issue, bug fix, feature, PR, or implementation task — for every project work item without exception. Performs an applicability check to decide whether a full design/test-first plan is needed. Default to full workflow: if the task has ANY edge cases, negative cases, boundary conditions, typed contracts, escaping, or more than one acceptance criterion, use the full workflow. Only skip for purely mechanical changes with zero behavioral edge cases. Triggers on: story, issue, bug fix, feature, PR, implementation, task, test-first, TDD, design plan, implementation gate, behavior matrix, design-first."
allowed-tools:
  - Read
  - Agent
---

# Test-First Design

Prevent happy-path-only implementation by making expected behavior and tests explicit before production code is written. The central discipline: separate what is *stored* from what readers *derive*, and enumerate failure modes deliberately rather than discovering them in review.

## Activation rule

Perform the applicability check and record the minimum required output:

```markdown
## Test-first design applicability

- Full workflow needed? yes/no
- Reason:
- If no, why safe to skip:
```

**Default to full workflow.** If the issue, acceptance criteria, or implementation surface has *any* edge cases, negative cases, boundary conditions, typed contracts, escaping requirements, or non-trivial acceptance criteria beyond a single happy path — use the full workflow. The bar for skipping is high: the change must be purely mechanical (renaming, formatting, dependency bumps, docs-only) with zero behavioral edge cases. When in doubt, run the full workflow. Do not rationalize skipping by minimizing the complexity of edge cases or classifying them as "not heavy enough."

## Core rule

Do not spawn the implementation agent until the design agent's plan has passed the Implementation gate. If behavior is ambiguous at any point, pause and surface the ambiguity to the user with proposed solutions before proceeding.

## Never

- NEVER conflate persisted state with derived/read-time state. They diverge once time, policy, permissions, or compatibility rules are applied; a test that asserts on one silently passes the other, hiding the bug until production. **Classic failure**: `status == "stale"` passes in tests because freshness is evaluated at write-time, but consumers read rows written before the policy changed and see a different value — the divergence only appears after a policy rollout.
- NEVER patch a review finding's local symptom. A finding is evidence of a missing design rule — fix the rule and add a test, or the same class of bug returns elsewhere. **Classic failure**: a null-pointer fix lands, review closes, and three similar callers hit the same null two weeks later because the invariant ("this field is always populated after step X") was never stated or tested.
- NEVER let migration-time and runtime classify the same old data differently. Backfill and live reads must agree on what "stale", "missing", or "complete" mean, or rows will flip state on the next write. **Classic failure**: migration marks rows as `complete` using the old definition; runtime re-evaluates them with the new definition and silently flips them to `incomplete` on first touch, corrupting data that the migration was meant to preserve.
- NEVER ship happy-path-only behavior. If an unhappy path is hard to specify, that is a design gap to resolve before coding, not an implementation detail to improvise. **Classic failure**: retry behavior is left "TBD" and the implementation silently creates duplicate records on re-delivery because idempotency was never specified.
- NEVER skip negative assertions for security/privacy work. "No leakage" and "no forbidden side effect" must be asserted explicitly; their absence is not evidence of their safety. **Classic failure**: a test asserts the correct user's data is returned but never checks that another user's data is absent — the permission bug passes every test and reaches production.
- NEVER send a spawned agent a vague prompt. Include the full task description, relevant file context, and explicit instruction to cover all applicable workflow steps — a thin prompt produces a shallow plan that passes review and only reveals gaps during implementation. **Classic failure**: agent receives "design the retry logic" with no file context, produces a generic exponential-backoff plan, and misses the idempotency constraint that was obvious from the existing schema.
- NEVER let a spawned agent's deliberation accumulate in main context. Only the final approved plan (from the design agent) and the final Verification summary (from the implementation agent) should be copied into main context — intermediate drafts, back-and-forth feedback, and discarded paths are noise that crowds out later context. **Classic failure**: two rounds of agent iteration land in full in main context; by the time implementation starts the context window is half full and later tool calls get truncated.
- NEVER give the implementation agent the task description without the approved plan. The agent must implement against the test matrix, not re-derive intent from the original description — re-derivation produces a different plan and silently invalidates the design review. **Classic failure**: implementation agent is handed the ticket description, produces a slightly different interpretation of idempotency behavior, and the divergence only surfaces in a production incident.

## Scope

Not every step applies to every change. Use this to route:

| Condition | Required steps |
|---|---|
| Any issue/story/PR implementation | Applicability check (main agent) |
| Full workflow applies | Design agent: steps 1–7 → Main agent: review plan → Implementation agent: steps 8–9 → Main agent: review results |
| Stateful / status / freshness logic | Design agent also produces step 5 state-transition table |
| Schema or data-shape change | Design agent also produces step 6 migration/backfill rules |
| Review finding arrives mid-work | Implementation agent: step 9 review loop |

**Full workflow triggers** (any one is sufficient):

- Stateful, persistence, or read-model logic
- API or contract changes (including new API clients or typed contract types)
- Migrations or schema changes
- Security, privacy, escaping, or authorization behavior
- Integration or cross-boundary data flow
- Retry, idempotency, or failure-recovery logic
- Any acceptance criteria naming negative cases or boundary conditions
- More than one non-trivial acceptance criterion
- Typed contract consumption or production (frontend or backend)
- Any explicit escaping, sanitization, or injection-prevention requirement
- Any UI rendering of backend-governed data with distinct empty/error/boundary states

**Skip triggers** (all must be true to skip):

- Change is purely mechanical: rename, format, dep bump, docs-only, or config-only
- Zero behavioral edge cases exist
- No acceptance criteria name negative cases or boundary conditions
- No typed contracts are introduced or consumed

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

If the full workflow does not apply: **do NOT load** `references/templates.md` — record why it is safe to skip and proceed.

If the full workflow applies:

**MANDATORY — load `references/templates.md`**, then spawn two agent phases:

### Phase 1: Design agent (steps 1–7)

1. **Spawn a design agent** with isolated context, with a prompt that includes: the full task description, relevant file context, and an instruction to produce the complete Design/test plan (all applicable steps from the workflow, using the template from `references/templates.md`).
2. **Review the returned plan** against the Implementation gate checklist. Ask: "Which check is hardest to answer?" — that is the likeliest gap.
3. **If gaps are found**: send the plan back to the agent with specific feedback identifying the missing rules or uncovered paths. Accept the revision. Repeat at most once (2 rounds total). If round 2 is still insufficient, do not proceed — surface the remaining gap to the user with 2–3 proposed resolutions and ask them to choose.
4. **Approve the plan.** Copy only the final approved plan into main context — not the deliberation.

### Phase 2: Implementation agent (steps 8–9)

1. **Spawn an implementation agent** with isolated context, with a prompt that includes: the approved plan verbatim, relevant file context, and an instruction to implement only against the test matrix and produce the Verification summary on completion.
2. **Review the returned Verification summary.** Check:
   - Did the agent implement against the test matrix (not ad hoc)?
   - Is the acceptance criteria trace complete?
   - Were any new special cases discovered and added to the matrix?
   - Are there open questions that need resolution before the work is done?
3. **If the summary is incomplete or new cases were added without design coverage**: send feedback to the agent for a follow-up pass. Repeat at most once. If round 2 is still insufficient, do not accept — surface the specific uncovered cases to the user with 2–3 proposed resolutions and ask them to choose before continuing.
4. **Accept the result.** Copy only the final Verification summary into main context — not the implementation deliberation.

## Implementation gate

Before approving Phase 2 output, ask: "Which of these checks is hardest to answer right now?" The hardest one is the likeliest gap — send the agent back if any answer is no for a relevant category.

- Are source-of-truth and derived/read-time values separated?
- Are partial and missing inputs specified?
- Are repeated failures specified?
- Are migration semantics specified?
- Are tests named for the behavior, not the implementation?
- Are security/privacy negative assertions included where relevant?

## Verification summary

When Phase 2 is complete, the Verification summary from `references/templates.md` is produced by the implementation agent. **Do NOT load** `references/templates.md` a second time if it is already in context.

## Structure note

If this file exceeds 300 lines, move workflow steps 1–7 detail to `references/workflow-steps.md` and load it inside the design agent prompt rather than the main SKILL.md body.
