# Evidence-Grounded Design and Test Workflow

Load this reference when the applicability check selects the full workflow. It owns evidence grounding, behavior design, test planning, implementation sequencing, and review-loop discipline. Load `templates.md` at the same time for the required plan and verification formats.

## 0. Ground the design before synthesis

Before defining goals, invariants, reachability, or risk:

1. Establish the target repository/workdir and read `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, or equivalent local instructions.
2. Inspect the issue, acceptance criteria, linked design/contract, explicitly stated non-goals, and dependency gates.
3. Inspect relevant source, tests, public/API contracts, schemas, migrations, configuration, and operational runbooks with Pi-native tools such as `read`, `bash` search commands, and targeted shell checks as appropriate.
4. Inspect recent history or current runtime behavior when it materially affects compatibility or reachability.
5. For bugs, reproduce or obtain source-level evidence of current behavior, and establish root cause before designing the fix.
6. Record evidence sources and unresolved gaps. Material invariants and causal claims must cite inspected evidence, not assumed architecture.

An uninspected path cannot be rated low. A material evidence gap is `unknown` and may block implementation.

## 1. Restate the goal

State desired behavior rather than a proposed code change. Record:

- acceptance criteria;
- non-goals;
- explicitly out-of-scope behavior;
- compatibility constraints;
- authority boundaries and external dependencies.

## 2. Identify invariants

List what must remain true across the change. Check especially:

- data ownership and authoritative source of truth;
- public-contract compatibility;
- persisted-state/read-model consistency;
- idempotency and retry safety;
- migration/runtime agreement;
- authorization, privacy, and forbidden side effects;
- atomicity and externally visible actions.

Keep persisted and derived state separate:

- **Persisted state** is what is stored.
- **Derived/read-time state** is what readers observe after applying time, policy, permissions, compatibility, or presentation rules.

## 3. Define happy paths

Write normal success behavior concretely:

```text
Given previous state X
When valid input Y arrives
Then persisted state is A
And read model is B
And no forbidden side effect C occurs
```

## 4. Enumerate unhappy paths

Consider applicable cases rather than copying a quota:

- missing, partial, invalid, malformed, or conflicting input;
- duplicate, repeated, out-of-order, stale, or expired input;
- failure after success and success after failure;
- empty-but-valid or no-op input;
- exact boundary values and unsupported versions;
- unknown identities or references;
- upstream/downstream unavailability and ambiguous remote completion;
- retention/deletion and security/privacy leakage;
- migration from old data shapes and backfill/reconciliation;
- retry, idempotency, and partial-commit behavior.

If a path is difficult to specify, classify the ambiguity using the blocking/non-blocking policy in `SKILL.md`. A non-blocking default requires inspected evidence, explicit authorization, reversibility, and a test. Otherwise stop and ask.

If an unhappy path could violate an important invariant, load `risk-assessment-and-treatment.md` before proceeding.

## 5. Route conditional design work

- Stateful, status, freshness, concurrency, retry, or idempotency behavior: load `state-transitions.md`.
- Schema, data-shape, backfill, compatibility-window, or migration behavior: load `migration-and-backfill.md`.
- Security/privacy, persistence, financial, irreversible external effects, or any potentially material invariant violation: load `risk-assessment-and-treatment.md`.

## 6. List tests before implementation

Build a test matrix. Every behavior rule maps to a test or documented validation step. Every medium/high/critical risk maps to a test. High/critical risks also require detection validation and either:

- recovery/rollback validation when recovery is possible; or
- explicit irreversibility with stronger prevention, containment, and incident-response validation.

A passing test provides assurance that a treatment behaves as designed; it does not lower inherent risk.

Prefer behavior-encoding names:

```text
test_failed_refresh_after_success_preserves_previous_visible_metrics
test_freshness_becomes_stale_at_read_time_without_new_write
test_migration_backfills_metric_bearing_rows_without_state_as_collected
```

For each test record:

- fixture/setup;
- action;
- expected persisted state;
- expected read model/output;
- negative assertions, especially no leakage or forbidden side effects;
- associated invariant, risk ID, or open-question ID.

## 7. Implement only against the matrix

After the design and tests are defined, implement the smallest code necessary.

When implementation reveals a new special case:

1. Stop.
2. Add the behavior or transition to the plan.
3. Assess its risk if it can violate an invariant.
4. Add or update the test.
5. Then implement.

## 8. Review-loop discipline

A review finding is evidence of a missing design rule, not merely a local symptom.

For each finding:

1. Identify the missing rule or invariant.
2. Add it to the behavior/transition matrix.
3. Add or update a test.
4. Patch the rule rather than only the observed symptom.
5. Record the finding in the final verification summary.

## Verification gate

Before implementation, verify:

- evidence grounding is complete or material gaps are explicitly blocking;
- every open question is blocking/non-blocking with evidence and authority;
- persisted and derived state are separated;
- partial, missing, repeated, and failure-after-success behavior is specified;
- conditional state-transition and migration references were loaded when triggered;
- tests are named for behavior and include negative assertions where needed;
- all material invariant violations were routed through risk assessment;
- `templates.md` was used for the plan.

Before any requested push, run checks proportional to the artifact: compile/lint/test affected code or configuration, and repository-provided formatting/link/document checks for docs-only work. If required checks cannot run locally, use an approved CI/remote path when available, state the exact gap, and do not claim verification. Do not push with a material unverified gap unless repository policy permits it and the user explicitly accepts it.

## Common pitfalls

1. Reading repository instructions after designing rather than before.
2. Claiming no behavioral change without an equivalence test or tool evidence.
3. Treating persisted and derived/read-time state as interchangeable.
4. Writing only happy-path tests.
5. Allowing an implementation-discovered special case to bypass the plan and test matrix.
6. Fixing a review symptom without repairing the missing invariant or test.
7. Treating a passing test as proof that the original consequence was low.
