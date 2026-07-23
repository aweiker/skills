# Migration, Backfill, and Compatibility Design

Load this reference when work changes schemas, serialized data shapes, classification semantics, defaults, retention, backfills, compatibility windows, or old/new application coexistence. Load `state-transitions.md` when live writes can race migration, and `risk-assessment-and-treatment.md` for material persistence/availability/privacy risks.

## Define semantic upgrade rules

A migration is not only DDL or field transformation. Define how old data becomes valid under new behavior.

Cover:

- complete old rows;
- rows missing optional old data;
- partial or inconsistent rows;
- empty tables/datasets;
- malformed or unsupported legacy values;
- records created during rollout;
- deleted/retained data;
- downgrade behavior, if supported;
- runtime handling before, during, and after migration.

Migration-time and runtime classification must agree on meanings such as stale, missing, complete, valid, authorized, or deleted. If the same record changes classification merely because it was backfilled or rewritten, the semantic rule is incomplete.

## Establish authority and compatibility

Record:

- authoritative source for each migrated value;
- whether a value is stored or derived;
- old and new reader/writer compatibility;
- rollout order and version window;
- whether dual-read/dual-write exists and its exit condition;
- default behavior when new data is absent;
- public/API contract compatibility;
- when old fields can be removed.

Do not backfill a derived/read-time value as if it were authoritative without proving it remains valid as time, policy, or permissions change.

## Backfill/live-write interaction

Specify:

- selection/watermark strategy;
- batch identity and resumability;
- optimistic version or compare-and-swap behavior;
- what happens when a live write races the backfill;
- whether backfill may overwrite newer data;
- idempotency across retries;
- partial batch failure and restart;
- reconciliation for skipped/conflicted rows;
- completion evidence and post-run validation.

When races or lifecycle transitions are possible, use the transition table from `state-transitions.md`.

## Rollout and rollback

Define the rollout sequence, including:

1. compatibility preparation;
2. schema/data change;
3. old/new reader and writer coexistence;
4. backfill/reconciliation;
5. validation and monitoring;
6. old-path removal.

Rollback must distinguish:

- code rollback while new schema remains;
- schema rollback;
- data transformation rollback;
- irreversible migration where rollback is impossible.

For genuinely irreversible transformations, do not invent rollback. Require backup/restore or equivalent prevention where feasible, dry-run/sample validation, bounded batches, stop conditions, monitoring, reconciliation, and incident-response planning. Record residual risk and authorized acceptance.

## Migration test matrix

Test applicable cases:

- complete old record;
- missing optional data;
- partial/inconsistent old record;
- malformed legacy value;
- empty dataset;
- repeated migration/backfill execution;
- interrupted batch and resume;
- live write racing backfill;
- old reader/new writer and new reader/old writer;
- read behavior before versus after migration;
- downgrade/rollback or explicit irreversibility;
- retention/deletion and privacy constraints;
- no data loss, leakage, or unauthorized default expansion.

For each case assert:

- resulting stored values;
- resulting read model;
- conflict resolution;
- idempotency/retry behavior;
- detection signal;
- repair/reconciliation path;
- associated risk ID when an invariant can be violated.

## Gate

Before implementation or execution, verify:

- semantic upgrade rules cover all applicable old-data shapes;
- migration and runtime classify identical data consistently;
- source-of-truth versus derived data is explicit;
- old/new compatibility and rollout order are explicit;
- live-write races and restart behavior are designed;
- irreversible effects are identified without fictional rollback;
- material migration risks use `risk-assessment-and-treatment.md`;
- tests and operational validation prove completeness and safety;
- stop conditions, ownership, and reconciliation are defined.

## Common pitfalls

1. Treating schema success as semantic migration success.
2. Backfilling a time- or permission-derived value as permanent truth.
3. Letting live writes and backfill use conflicting precedence rules.
4. Assuming one-shot execution rather than resumability and idempotency.
5. Supporting new writers before old readers can tolerate the shape.
6. Calling an irreversible transformation rollback-safe because code can be reverted.
7. Validating row counts without validating meaning, conflicts, and read behavior.
