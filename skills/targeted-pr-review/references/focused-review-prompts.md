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
- For each finding, include severity, file/line if possible, violated invariant, why it matters, and a concrete recommended fix.
- Distinguish blocking issues, optional polish, false positives, and questions needing human decision.
- If no blocking issues are found for this pass, say so clearly.
- Do not include secrets, credentials, raw payload mirrors, or large logs.
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
Focus only on missing tests relative to design docs, PR claims, and changed behavior.

For each missing test, identify:
- the behavior/invariant claimed;
- the file/function where it is implemented or should be;
- why existing tests do not cover it;
- a concrete test name and setup/action/assertion outline.

Prioritize negative tests and edge cases over happy paths.
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
