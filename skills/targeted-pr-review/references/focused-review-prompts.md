# Focused review prompt templates

Use these as starting points. Adapt each prompt with the discovered repo instructions, selected docs, changed files, PR/issue context, and generated invariants.

## Common read-only header

```text
You are performing one focused, read-only review pass for this repository/branch.

Instructions:
- Do not modify files.
- Review the current branch diff against the selected base plus relevant surrounding code.
- Follow repository instructions discovered during intake.
- Use the selected design/domain/implementation docs as source-of-truth for intended behavior.
- For each finding, include severity, file/line if possible, violated invariant, named failure case/opposite, proof gap, why it matters, and a concrete recommended fix.
- Do not call code correct until you cite the guard, validator, contract, test, or repro that blocks the named failure case.
- Distinguish blocking issues, optional polish, false positives, and questions needing human decision.
- If no blocking issues are found for this pass, say so clearly.
- Do not include secrets, credentials, raw payload mirrors, or large logs.
```

## Invariant proof / correctness pass

```text
Focus only on proving or disproving the PR's behavioral invariants.

Produce an artifact:
| Invariant | Source | Failure case/opposite | Code proof | Test proof | Gap/finding |

Rules:
- Every invariant must name the opposite/failure case.
- Code proof must cite the exact guard, validator, branch, contract boundary, or state transition that blocks the failure case.
- Test proof must cite a test that would fail if the failure case were allowed; happy-path tests are not enough for absence/null/security/failure behavior.
- If proof is missing, classify it as a finding, test gap, or review-incomplete question. Do not infer correctness from passing broad tests.
```

## Diff-added dereference / nullability pass

```text
Focus only on new or moved dereferences and required-value assumptions introduced by the diff.

Inventory language-appropriate crash/defaulting patterns, including chained getters, enum/name/toString calls, size/stream calls, nullable unboxing, Optional.get, Map.of/List.of with nullable values, non-null assertions, destructuring, and logging/MDC/metrics field reads.

Produce an artifact:
| Added dereference or required value | Consumer/entrypoint | Why value may be absent/null/invalid | Producer(s) traced | Guard/validator/contract proof | Test proof | Gap/finding |

Rules:
- Review logging, telemetry, metrics, tracing, and MDC code as production behavior.
- A guard after the dereference does not prove safety.
- Constructor/schema/validator proof must be cited; "field should always exist" is not proof.
- For every nullable/absence-sensitive row, trace the real producer or builder that supplies the consumed object. A mocked DTO/input in a unit test is not producer proof.
- If absence is possible, expected behavior should be domain-specific handling or a deliberate validation error, not incidental NullPointerException/panic/type error.
```

## Required-field producer/consumer contract pass

```text
Focus only on mismatches between fields a changed consumer requires and fields real producers set.

Use this pass whenever a changed method dereferences a DTO/model/event/config/request/context field whose object is built outside that method.

Produce an artifact:
| Consumer requires | Consumer proof | Producer/call path | Producer sets it? | If missing, runtime result | Test uses real producer? | Gap/finding |

Rules:
- Consumer proof is the exact dereference, null-rejecting constructor, unboxing, or required-value branch.
- Producer/call path must name the real builder/mapper/parser/factory/deserializer/upstream contract and the entrypoint that connects it to the consumer.
- If multiple producers can reach the consumer, enumerate them or group by type with explicit coverage.
- Tests that mock the consumer input or hand-build a richer object than production are evidence of a test gap, not correctness.
- A field set by one producer does not prove all in-scope producers set it.
- If producer proof is missing, classify as finding, test gap, or review-incomplete; do not call the consumer safe.
```

## Mock-vs-real-path test falsifier add-on

```text
When tests pass for code that consumes DTOs/models/events, check whether the test uses the same producer as production.

Look for:
- tests stubbing a mapper/builder/factory and returning a hand-built object;
- production builder omitting a field that the test supplies;
- assertions against a mock interaction without exercising the real mapping path;
- happy-path test fixtures that always set optional fields.

A passing mock-only test does not prove the producer/consumer contract.
```

## State machine / fail-closed pass

```text
Focus only on lifecycle/status/state-machine correctness and fail-closed behavior.

Look for:
- paths that open a gate/status without all prerequisites;
- stale success after reset/failure;
- terminal failure accidentally reopening;
- duplicate/out-of-order messages;
- reset/stop/rebuild races;
- missing-state or missing-storage behavior;
- errors swallowed in ways that leave stale ready/success state.
```

## OTP/process responsiveness and ownership pass

```text
Focus only on OTP/process ownership, GenServer/Supervisor behavior, and responsiveness.

Look for:
- blocking network/disk/reconciliation work in GenServer callbacks;
- process ownership violations, especially ETS/table ownership;
- unsafe async work using stale state;
- missing supervision/monitoring for background tasks;
- process dictionary assumptions;
- crash/restart semantics that violate the design docs;
- calls/casts to absent processes that silently lose required work.
```

## API contract / idempotency compatibility pass

```text
Focus only on existing public contracts and backward compatibility.

Look for:
- documented idempotency broken by new checks;
- changed return shapes or error taxonomy;
- retry behavior regressions;
- public reads unexpectedly blocked by new gates;
- validation bypasses;
- inconsistent docs/tests/implementation;
- callers that depend on previous ordering or side effects.
```

## Security/privacy/ownership pass

```text
Focus only on security, privacy, least privilege, and ownership boundaries.

Look for:
- public mutable state that should be protected/private;
- secrets, credentials, tokens, raw payloads, or broker responses in logs/events/errors;
- fail-open behavior on dependency failure;
- authorization/scope/provider confusion;
- unsafe diagnostics;
- user data crossing tenant/user boundaries;
- missing negative tests for forbidden mutation or leakage.
```

## Persistence/event/replay consistency pass

```text
Focus only on persisted state, replay/backfill, and derived read models.

Look for:
- replay behavior diverging from live writes;
- partial write/index inconsistency;
- migration/backfill semantics missing or inconsistent;
- stored state conflated with read-time derived state;
- idempotency keys/client IDs not rebuilt or deduplicated correctly;
- event payload compatibility issues.
```

## Configuration/topology/dependency wiring pass

```text
Focus only on runtime topology, config/options, dependency injection, and rebuild fingerprints.

Look for:
- options accepted by lower layers but dropped by topology;
- runtime-only dependencies incorrectly included/excluded from fingerprints;
- config changes that should rebuild but do not, or should not rebuild but do;
- inconsistent defaults across layers;
- test fakes/options not matching production wiring;
- credential/provider/scope propagation issues.
```

## Observability/error taxonomy pass

```text
Focus only on logs, telemetry, lifecycle/audit events, and error classification.

Look for:
- missing or misleading success/failure telemetry;
- raw/sensitive payloads in logs/events;
- swallowed errors with no observable signal;
- error categories too broad to operate on;
- lifecycle events emitted too often or not at all;
- tests missing for observable behavior claimed by docs.
```

## Test-gap pass

```text
Focus only on missing tests relative to design docs, PR claims, changed behavior, and local validation results.

For each missing test, identify:
- the behavior/invariant claimed;
- the file/function where it is implemented or should be;
- whether local compile/unit commands were run, skipped, blocked, or failed;
- why existing tests and any passing local validation do not cover it;
- a concrete test name and setup/action/assertion outline.

Prioritize negative tests and edge cases over happy paths. Passing unit tests do not prove untested invariants, producer/consumer contracts, or absent/null/security/failure behavior.
```

## Scope/intent pass

```text
Focus only on whether the diff matches the issue, roadmap, and design-plan intent.

Look for:
- out-of-scope behavior;
- incomplete acceptance criteria;
- docs updated beyond implemented behavior;
- implementation that contradicts domain language;
- follow-up work that should be explicitly deferred.
```
