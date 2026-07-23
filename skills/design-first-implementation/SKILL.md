---
name: design-first-implementation
description: "Always load at the start of story, issue, bug fix, feature, PR, implementation, or other non-trivial code-changing work. Decide whether a full evidence-grounded design/test plan is required, then progressively load guidance for behavior, risk treatment, state transitions, migrations, and verification before production code. Default to the full workflow unless the change is purely mechanical with no material invariant, contract, state transition, edge case, or side effect. Triggers on: design-first, test-first, TDD, implementation gate, behavior matrix, stateful behavior, APIs/contracts, retries, idempotency, schemas, migrations, security/privacy, irreversible effects, edge cases."
allowed-tools:
  - Read
  - Agent
  - Bash
---

# Design-First Implementation Router

## Overview

Prevent happy-path-only implementation by deciding the required design depth before production code, grounding decisions in inspected evidence, and loading detailed knowledge only when its trigger applies.

The core discipline is mandatory; catalogs and templates are conditional. Do not preload every reference.

## Activation and applicability

At the start of any story, issue, bug fix, feature, PR implementation, or non-trivial code change, produce:

```markdown
## Test-first design applicability

- Full workflow needed? yes/no
- Reason:
- If no, why safe to skip:
```

Default to the full workflow. Use it when work is non-trivial or touches state, persistence, APIs/contracts, schemas, migrations, security/privacy, integrations, retries, idempotency, retention, reconciliation, irreversible/external effects, typed contracts, escaping/sanitization, UI rendering of backend-governed data, or important edge cases.

The full workflow may be skipped only for mechanical edits, typo/formatting changes, documentation-only changes, dependency bumps, config-only changes, or an obvious one-line refactor after recording why no material invariant, contract, state transition, edge case, or side effect is affected.

For bugs, reproduce or obtain source-level evidence of current behavior and establish root cause before designing the fix.

## Progressive-loading map

Load each triggered reference once. Do not load references whose trigger is absent.

| Trigger | Load | Purpose |
|---|---|---|
| Full workflow selected | `references/workflow-and-testing.md` and `references/templates.md` | Evidence grounding, behavior plan, tests, implementation sequence, final output |
| Any unhappy path/transition can violate an important invariant; or work touches security/privacy, persistence integrity, financial/authorization, irreversible effects, or material operational risk | `references/risk-assessment-and-treatment.md` | Calibrated risk, removal vs mitigation, user decision and containment gates |
| Persisted status, lifecycle, freshness, concurrency, events, retry/idempotency, time-dependent reads, remote side effects, or distributed consistency | `references/state-transitions.md` | Transition scenarios, atomicity, duplicates, ordering, unknown completion |
| Schema/data-shape/default/retention change, backfill, compatibility window, or old/new version coexistence | `references/migration-and-backfill.md` | Semantic upgrades, rollout, live-write races, reversibility, validation |

A risk, state-transition, or migration trigger implies the full workflow: load `workflow-and-testing.md` and `templates.md` first if they are not already loaded. Conditional references may then trigger one another. Follow their explicit load instructions rather than loading siblings speculatively.

## Core safety contract

These rules remain active even before detailed references are loaded.

### Evidence precedes synthesis

Before defining material invariants, reachability, or severity, inspect repository instructions, acceptance criteria, relevant source/tests/contracts/schema/configuration, and applicable history/runtime evidence. An uninspected path cannot be rated low. Missing evidence for a material dimension is `unknown` and may block implementation.

### Ambiguity must be classified

- **Blocking:** affects requirements, compatibility, security/privacy, persistence, data ownership, irreversible/external effects, or a potentially-high unknown. Pause and ask.
- **Non-blocking:** demonstrably low-impact, reversible, outside material invariants, and covered by standing policy or prior authorization. Record evidence, the authorized default, and a test/risk ID.

If classification or authority is uncertain, it is blocking. Do not convert a material ambiguity into a guessed test-pinned behavior.

### Material risks require evidence and treatment

A material risk needs this chain:

```text
reachable trigger -> incorrect behavior/transition -> violated invariant -> direct consequence
```

Do not rationalize risk downward because remediation is inconvenient, the path seems rare, code is internal, or tests pass. Do not inflate risk through category labels or unrelated hypothetical failures. Use `unknown` when materiality or reachability is unresolved.

Removal eliminates a causal link at an authoritative boundary and assesses replacement risk. Prevention, containment, detection, recovery, tests, monitoring, and rollback are not removal while the hazard remains reachable. Load `risk-assessment-and-treatment.md` for ratings and treatment decisions.

### High-risk feedback occurs before action

For every high/critical risk and potentially-high unknown, tell the user **before implementation or the hazardous action**:

- the evidence-backed chain, violated invariant, and concrete consequence;
- removal and mitigation options, replacement risks, and recommendation;
- any authorized reversible action already taken;
- residual risk, detection/recovery or irreversibility plan;
- authorized acceptance owner and specific decision required.

If discovered mid-work, pause before further affected mutation. Never guess risk tolerance, required behavior, acceptance authority, or a material trade-off. Ask with concrete options and a recommendation.

### Unilateral containment is narrowly bounded

Without explicit user authorization, containment is limited to preserving evidence, making no new mutation/external dispatch, or maintaining/entering a documented default-deny state already authorized by policy or an exact runbook.

Do not delete data, rotate credentials, revoke access, disable shared services, alter availability, discard queued work, or perform public/external actions without explicit authorization or an exact runbook. Any permitted mutation requires a rollback/restoration handle and immediate read-back verification. If containment safety or authority is uncertain, stop and ask.

### Irreversibility is explicit

When recovery is possible, validate recovery/rollback. When harm is genuinely irreversible, record that fact and require stronger prevention, containment, and incident-response validation. Never invent a rollback to satisfy a checklist.

## Pi delegation and context contract

Use isolated design/implementation workers when the task scope, workflow, or user request calls for delegation. If the user explicitly asks the main agent to implement directly, the main agent still must satisfy the same evidence, design, implementation-gate, test-matrix, and verification requirements before editing.

When spawning design or implementation workers, use the newest approved high-capability model exposed by the core AI proxy:

```text
hai-aicore-anthropic/anthropic--claude-4.8-opus
```

If the available Agent tool exposes model selection, set the worker model to that exact ID. If the generic Agent tool does not expose model selection, spawn the worker with `pi --model hai-aicore-anthropic/anthropic--claude-4.8-opus ...` while preserving isolated context and the required prompt contents. If neither path can guarantee the model, do not silently fall back; pause and tell the user that the worker model could not be enforced.

When delegating, preserve two isolated phases while using the progressive reference structure:

### Phase 1: Design worker

1. Spawn a design worker with isolated context. Include the full task, inspected evidence, relevant file context, the loaded `workflow-and-testing.md` and `templates.md` requirements, and any triggered risk/state/migration references.
2. Instruct the worker to produce the complete design/test plan from `templates.md`, not a free-form plan.
3. Review the returned plan against the mandatory implementation gate. Ask: "Which check is hardest to answer?" The hardest gate check is the likeliest gap.
4. If gaps remain, send one focused revision request identifying the missing evidence, rules, risks, transitions, or tests. If the revision is still insufficient, do not proceed; ask the user with 2–3 concrete resolutions and a recommendation.
5. Approve the plan and copy only the final approved plan into main context.

### Phase 2: Implementation worker

1. Spawn an implementation worker only after plan approval. Give it the approved plan verbatim, relevant file context, and instruction to implement only against the test matrix and produce the `templates.md` verification summary.
2. Review the returned verification summary for matrix adherence, acceptance-criteria traceability, new special cases, open questions, validation evidence, and any review-loop findings.
3. If the summary is incomplete or new cases bypassed design coverage, send one focused follow-up request. If the follow-up is still insufficient, do not accept; ask the user with the specific uncovered cases and 2–3 proposed resolutions.
4. Accept the result and copy only the final verification summary into main context. Do not copy worker deliberation, discarded paths, or intermediate drafts.

## Worker model rule

When spawning design or implementation workers, use the newest approved high-capability model exposed by the core AI proxy:

```text
hai-aicore-anthropic/anthropic--claude-4.8-opus
```

If the available agent-spawn tool exposes model selection, set the worker model to that exact ID. If the generic Agent tool does not expose model selection, spawn the worker with `pi --model hai-aicore-anthropic/anthropic--claude-4.8-opus ...` (preserving isolated context and the required prompt contents). If neither path can guarantee the model, do not silently fall back; pause and tell the user that the worker model could not be enforced.

## Never

- NEVER conflate persisted state with derived/read-time state. They diverge once time, policy, permissions, or compatibility rules are applied.
- NEVER patch a review finding's local symptom. A finding is evidence of a missing design rule: fix the rule and add a test.
- NEVER let migration-time and runtime classify the same old data differently.
- NEVER ship happy-path-only behavior. Hard-to-specify unhappy paths are design gaps, not implementation details.
- NEVER skip negative assertions for security/privacy work. "No leakage" and "no forbidden side effect" must be asserted explicitly.
- NEVER send a spawned agent a vague prompt. Include the task, evidence, relevant file context, loaded-reference triggers, and required output format.
- NEVER let spawned-agent deliberation accumulate in main context. Keep only approved outputs.
- NEVER give an implementation worker the task description without the approved plan.
- NEVER load every reference "just in case"; orphaned context weakens review quality.
- NEVER treat an empty template heading as proof that required scenarios were assessed.

## Execution sequence

1. Produce the applicability check.
2. If skipping, do **not** load `references/templates.md`; record why skipping is safe and perform proportionate verification.
3. If full workflow applies, load `workflow-and-testing.md` and `templates.md`.
4. Inspect evidence before writing the plan.
5. Load risk, transition, and migration references only when triggered.
6. Produce the design/test plan from `templates.md` before production code.
7. Resolve blocking questions and pass the implementation gate.
8. List tests before implementation; then implement only against the plan/matrix.
9. If implementation reveals a new case, stop, update the plan/risk/tests, then continue.
10. Produce the final verification summary from the already-loaded `templates.md`.

## Mandatory implementation gate

Before production implementation, verify:

- repository instructions, acceptance criteria, relevant source/tests/contracts/schema/configuration, and applicable history/runtime behavior were inspected;
- material invariants, reachability, and severity cite evidence or an explicit gap;
- bugs have reproduction/source-level proof and established root cause;
- every ambiguity is blocking/non-blocking with evidence and authorized handling;
- source-of-truth, persisted state, and derived/read-time state are distinct;
- partial, missing, repeated, failure-after-success, and forbidden-side-effect behavior is specified when applicable;
- all triggered references were loaded and their gates satisfied;
- tests are listed before implementation and trace to behavior, invariants, risks, and transitions;
- unknowns affecting important invariants are resolved or explicitly block implementation;
- high/critical controls include failure-path tests and detection, plus recovery/rollback when possible or explicit irreversibility alternatives;
- high/potentially-high risks were communicated before implementation/hazardous action;
- material residual-risk acceptance has an owner authorized for that risk domain;
- any unilateral containment was exactly authorized, minimally mutating, restorable when mutation was permitted, and immediately read back;
- temporary mitigation has an infeasibility rationale, authorized owner, review/expiration condition, monitoring, and permanent-treatment path.

If any relevant answer is no, continue designing or ask the user before coding. Ask: "Which of these checks is hardest to answer right now?" The hardest one is the likeliest gap.

## Output and verification

When the full workflow applies, `references/templates.md` is the canonical source for:

- Design/test plan;
- compact/full risk records;
- high-risk user decision record;
- state-transition table and category coverage;
- blocking/non-blocking open questions;
- final verification summary.

Do not duplicate or improvise alternate schemas in the core. Load the template once and reuse it.

Even when the full workflow is skipped, verification before any requested push is proportionate and mandatory: compile/lint/test affected code or configuration, or run repository-provided formatting/link/document checks for docs. If required checks cannot run locally, use approved CI/remote validation when available, state the exact evidence gap, and do not claim verification. Do not push with a material unverified gap unless repository policy permits it and the user explicitly accepts it.

## Structure note

If this file exceeds 300 lines, move additional workflow detail to references. Keep this entry point a router with activation rules, load triggers, hard safety contracts, and gates.
