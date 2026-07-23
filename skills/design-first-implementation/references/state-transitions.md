# State Transitions, Concurrency, and Idempotency

Load this reference when work touches persisted status, freshness, lifecycle transitions, retries, idempotency, concurrent writers, event ordering, time-dependent reads, remote side effects, or distributed consistency. Also load `risk-assessment-and-treatment.md` when any transition can violate an important invariant. Use this file's `State-transition table template` section for the canonical table.

## Separate stored and observed state

Never conflate:

- **Persisted state:** authoritative values stored at a defined write boundary.
- **Derived/read-time state:** values readers observe after applying time, policy, permissions, compatibility, or presentation rules.

A stale/fresh value derived from current time is not necessarily persisted status. A permission-filtered read model is not the stored object. Tests must assert both when they can diverge.

## Build the transition table before coding

Use the canonical fields below (see the `State-transition table template` section for the fillable table):

| Field | Purpose |
|---|---|
| Prior state/version | Authoritative starting point and concurrency version |
| Input/event identity | Event ID, request ID, idempotency key, version, or timestamp |
| Guards/preconditions | Authorization, expected version, terminal-state rules, required data |
| Outcome | Explicit accept, reject, or accepted no-op |
| Expected stored state | Post-transition authoritative values |
| Expected read model | Values visible after derivation/filtering |
| Side effects/atomicity boundary | External calls and commit ordering |
| Retry/idempotency behavior | Same key, duplicate event, stale event, and retry result |
| Detection/recovery | Signals and reconciliation/repair path |
| Risk ID/test | Traceability |

Do not use an empty heading as proof that transitions were assessed. Populate scenarios or record evidence that a category is impossible.

## Required scenario categories

For each applicable category, add scenarios or explain why it cannot occur:

### Concurrency and isolation

- concurrent writers and lost updates;
- compare-and-swap/version checks;
- transaction isolation and write skew;
- read-after-write consistency;
- stale read followed by overwrite;
- ownership or authorization changing during an operation.

### Duplicates, ordering, and identity

- duplicate and out-of-order events;
- repeated delivery after apparent success;
- stale-event regression;
- idempotency-key collision, reuse, expiration, and scope;
- same payload with different identity and different payload with same identity;
- explicit difference between rejected transition and accepted no-op.

### Partial completion

- crash/restart between side effect and persistence;
- persistence succeeds but response is lost;
- cancellation during an in-flight transition;
- timeout with unknown remote completion;
- partial commit across multiple stores;
- reconciliation after ambiguous completion.

### Time and lifecycle

- exact TTL/freshness boundary;
- clock skew and non-monotonic clocks;
- failure after success and success after failure;
- repeated failure;
- terminal-state escape attempts;
- retention/deletion transitions;
- status derived at read time without a new write.

### Distributed and deployment states

- split-brain or multi-region disagreement;
- old/new application versions coexisting;
- backfill racing live writes;
- partial migration resume/rollback;
- contract version mismatch.

## Atomicity and external side effects

For every externally visible side effect, identify:

1. authoritative decision boundary;
2. side-effect initiation point;
3. persistence/commit point;
4. what happens if the process crashes between them;
5. whether retry is safe and how identity is preserved;
6. how unknown completion is detected and reconciled.

Do not call a path idempotent merely because duplicate requests usually return the same value. Prove that the authoritative side-effect boundary prevents duplicate material effects for the full key scope and lifetime. Otherwise classify duplicate protection as mitigation with residual risk.

## Illegal transition policy

For every invalid transition define one of:

- **Reject:** return an explicit error and perform no mutation/side effect.
- **Accepted no-op:** return success-like behavior while proving state and side effects remain unchanged.
- **Reconcile:** move through an explicit repair transition with ownership, detection, and tests.

Never leave invalid transition behavior implicit.

## Tests

At minimum, test applicable scenarios for:

- each allowed transition;
- each rejected/no-op transition;
- duplicate and stale events;
- concurrent updates or version mismatch;
- crash/timeout around the atomicity boundary;
- retry after unknown completion;
- exact freshness/TTL boundary and clock skew;
- old/new version coexistence;
- persisted state versus read model;
- no forbidden external side effect.

Every table row must map to a test or documented validation. Material transition risks must map to `risk-assessment-and-treatment.md` records.

## Gate

Before implementation, verify:

- all applicable categories are covered or proven impossible;
- prior and resulting persisted states are explicit;
- read-time derivation is separate;
- accept/reject/no-op is explicit;
- side-effect and persistence ordering is explicit;
- retry/idempotency scope and lifetime are explicit;
- ambiguous completion has detection and reconciliation;
- transition risks have risk IDs and tests;
- deployment/migration coexistence is addressed when relevant.

## Common pitfalls

1. Asserting only the read model while persisted state is wrong.
2. Treating retries as safe without stable operation identity.
3. Returning a no-op without proving absence of side effects.
4. Allowing stale events to regress terminal or newer state.
5. Assuming timeout means failure when the remote side effect may have completed.
6. Ignoring cancellation and crash windows.
7. Testing sequential writes while production permits concurrent writers.
8. Letting backfill and live writes use different transition rules.

## State-transition table template

Populate before coding when a state/transition trigger applies:

| Prior state/version | Input/event identity | Guards/preconditions | Outcome (accept/reject/no-op) | Expected stored state | Expected read model | Side effects / atomicity boundary | Retry/idempotency behavior | Detection/recovery | Risk ID / test |
|---|---|---|---|---|---|---|---|---|---|

Applicable-category coverage—record scenarios or explain why impossible:

- [ ] Concurrent writers / lost updates / isolation / read-after-write
- [ ] Duplicate or out-of-order events
- [ ] Idempotency-key collision, reuse, expiry, and scope
- [ ] Crash/restart or cancellation during an in-flight transition
- [ ] Ambiguous remote completion
- [ ] Exact TTL boundaries and clock skew
- [ ] Authorization or ownership change during operation
- [ ] Split-brain or multi-region disagreement
- [ ] Backfill racing live writes
- [ ] Old/new application versions coexisting
- [ ] Partial migration resume/rollback
- [ ] Rejected transition versus accepted no-op
