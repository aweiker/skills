---
name: design-first-implementation
description: "Always load at the start of any story, issue, bug fix, feature, PR, implementation, task, or project work item — for every work item, no exceptions; the applicability check then decides whether the full evidence-grounded design/test plan is required or the item is safe to skip. When required, progressively load guidance for behavior, risk treatment, state transitions, migrations, and verification before production code. Default to the full workflow unless the change is purely mechanical with no material invariant, contract, state transition, edge case, or side effect. Triggers on: story, issue, bug fix, feature, PR, implementation, task, project work item, design-first, test-first, TDD, implementation gate, behavior matrix, stateful behavior, APIs/contracts, retries, idempotency, schemas, migrations, security/privacy, edge cases."
allowed-tools: read bash subagent
compatibility: "Full delegated workflow needs a private high-capability model (hai-aicore-anthropic/anthropic--claude-4.8-opus). Enforce it via a Pi CLI worker (pi --print --model ...) or a configured subagent agent whose definition pins that model. If neither is available, pause and obtain user authorization before running inline; all gates still apply."
---

# Design-First Implementation Router

## Overview

Prevent happy-path-only implementation by deciding the required design depth before production code, grounding decisions in inspected evidence, and loading detailed knowledge only when its trigger applies.

The core discipline is mandatory; catalogs and templates are conditional. Do not preload every reference.

## Activation and applicability

At the start of **any** story, issue, bug fix, feature, PR, implementation, task, or project work item (no exceptions), produce:

```markdown
## Test-first design applicability

- Full workflow needed? yes/no
- Reason:
- If no, why safe to skip:
```

This router loads for every work item; the applicability check decides whether to run the full workflow or skip it. Default to the full workflow. Use it when work is non-trivial or touches state, persistence, APIs/contracts, schemas, migrations, security/privacy, integrations, retries, idempotency, retention, reconciliation, irreversible/external effects, typed contracts, escaping/sanitization, UI rendering of backend-governed data, or important edge cases.

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

The full workflow **defaults to isolation**: run it as two isolated phases (a design phase, then an implementation phase), never inline in the main context by default. Run inline **only** when the user explicitly requires direct work or explicitly authorizes inline execution after no worker path can enforce the required model. Otherwise pause and explain the worker-model gap. When running inline, record the authorization, exception, and reason in the applicability check. Inline execution does **not** relax the evidence, design, implementation-gate, test-matrix, or verification requirements or weaken any gate.

### Required worker model

Delegated design/implementation workers must run on the newest approved high-capability model exposed by the core AI proxy:

```text
hai-aicore-anthropic/anthropic--claude-4.8-opus
```

Because this model must be pinned, and the Pi `subagent` tool has no `model` parameter while the currently configured `planner`/`worker` agents pin Sonnet, the **authoritative delegation path is the raw Pi CLI worker**. Use `subagent` only when the selected agent definition demonstrably pins the required model. If neither path can enforce the model, pause and obtain explicit user authorization before any inline exception.

### Phase 1: Design worker (read-only)

Representative Pi CLI call — design workers get a read-only tool allowlist (no `edit`/`write`); add `bash` only if evidence gathering needs a shell, with an explicit no-mutation instruction:

```bash
workdir="/absolute/path/to/target-repo-or-worktree"
cd "$workdir" || exit 1
timeout 1200s pi --print \
   --model hai-aicore-anthropic/anthropic--claude-4.8-opus \
   --session-id df-design-<slug> \
   --name "df-design <slug>" \
   --no-skills \
   --tools read,grep,find,ls \
   --no-approve \
   @/tmp/df-design-prompt-<slug>.md \
   > /tmp/df-design-result-<slug>.md
rc=$?
```

1. Write the prompt file (`@`-included above) with the full task, inspected evidence, relevant file context, the loaded `workflow-and-testing.md` and `templates.md` requirements, and any triggered risk/state/migration references. Set an explicit `cwd` = target repo/worktree. Instruct the worker: "Do not load or invoke `design-first-implementation`; do not spawn another Pi instance or subagent. Execute only this assigned phase."
2. Instruct the worker to produce the complete design/test plan from `templates.md`, not a free-form plan.
3. If `rc == 124`, report that the design worker exceeded its 20-minute bound, discard partial output, and do not advance phases. For any other `rc != 0`, do **not** treat partial output as an approved plan; surface the failing command and exit code to the user and do not advance phases.
4. Review the returned plan against the mandatory implementation gate. Ask: "Which check is hardest to answer?" The hardest gate check is the likeliest gap.
5. If gaps remain, send one focused revision request identifying the missing evidence, rules, risks, transitions, or tests. If the revision is still insufficient, do not proceed; ask the user with 2–3 concrete resolutions and a recommendation.
6. Approve the plan and copy only the final approved plan into main context.

### Phase 2: Implementation worker

Same session-id/name scheme (`df-impl-<slug>`), editing tool allowlist, and explicit `cwd`:

```bash
workdir="/absolute/path/to/target-repo-or-worktree"
cd "$workdir" || exit 1
timeout 1200s pi --print \
   --model hai-aicore-anthropic/anthropic--claude-4.8-opus \
   --session-id df-impl-<slug> \
   --name "df-impl <slug>" \
   --no-skills \
   --tools read,bash,edit,write,grep,find,ls \
   --no-approve \
   @/tmp/df-impl-prompt-<slug>.md \
   > /tmp/df-impl-result-<slug>.md
rc=$?
```

1. Spawn the implementation worker only after plan approval. The prompt file must contain the approved plan verbatim plus relevant file context and the instruction to implement only against the test matrix and produce the `templates.md` verification summary. It must also say: "Do not load or invoke `design-first-implementation`; do not spawn another Pi instance or subagent. Execute only this assigned phase." The design result is the handoff: approved plan text becomes the implementation worker's prompt input.
2. If `rc == 124`, report that the implementation worker exceeded its 20-minute bound, discard partial output, and do not advance. For any other `rc != 0`, do **not** treat partial output as an accepted verification summary; surface the failure and do not advance.
3. Review the returned verification summary for matrix adherence, acceptance-criteria traceability, new special cases, open questions, validation evidence, and any review-loop findings.
4. If the summary is incomplete or new cases bypassed design coverage, send one focused follow-up request. If the follow-up is still insufficient, do not accept; ask the user with the specific uncovered cases and 2–3 proposed resolutions.
5. Accept the result and copy only the final verification summary into main context. Do not copy worker deliberation, discarded paths, or intermediate drafts.

### Delegation controls

- **Isolation**: distinct `--session-id`/`--name` per phase; explicit `cwd` = target repo/worktree; only the approved plan / final verification summary cross into main context.
- **Project-file approval**: default `--no-approve` (do not auto-trust project-local Pi extensions/agents/skills). Use `--approve` only when the user has authorized trusting the target project's local Pi config, and state that explicitly.
- **Prompt/result capture**: pass prompts via `@file` under `/tmp`; redirect stdout to result files, or use `--mode json` when machine-parsing is needed.
- **`subagent` alternative**: permitted only when the selected agent definition pins the required model. Inspect the selected definition first; do not assume the model from the agent name. Representative design call:
  ```json
  {
    "agent": "<opus-pinned-design-agent>",
    "cwd": "/absolute/path/to/target-repo-or-worktree",
    "agentScope": "user",
    "task": "Design phase only. Read-only. Produce the complete design/test plan from references/templates.md using this full task, inspected evidence, relevant file context, and triggered references: <...>. Do not load or invoke design-first-implementation; do not spawn another Pi instance or subagent. Execute only this assigned phase."
  }
  ```
  Representative implementation call after plan approval:
  ```json
  {
    "agent": "<opus-pinned-implementation-agent>",
    "cwd": "/absolute/path/to/target-repo-or-worktree",
    "agentScope": "user",
    "task": "Implementation phase only. Implement only against this approved plan and test matrix, then return the references/templates.md Verification summary: <approved plan verbatim>. Do not load or invoke design-first-implementation; do not spawn another Pi instance or subagent. Execute only this assigned phase."
  }
  ```
  If the Opus-pinned agent is project-local, set `agentScope` to `project` or `both` only after the user approves trusting project-local agent files; leave `confirmProjectAgents` enabled. The current `planner`/`worker` agents pin Sonnet and do **not** satisfy this requirement. Do **not** mutate global agent definitions to force the model; use `subagent` only if/when an Opus-pinned agent is configured.

## Never

- NEVER conflate persisted state with derived/read-time state. They diverge once time, policy, permissions, or compatibility rules are applied — read models silently drift from stored truth after a policy rollout.
- NEVER patch a review finding's local symptom. A finding is evidence of a missing design rule: fix the rule and add a test — otherwise the same bug class resurfaces at other callers.
- NEVER let migration-time and runtime classify the same old data differently — rows flip state on the next write.
- NEVER ship happy-path-only behavior. Hard-to-specify unhappy paths are design gaps, not implementation details — an unspecified retry produces duplicate records.
- NEVER skip negative assertions for security/privacy work. "No leakage" and "no forbidden side effect" must be asserted explicitly — a "returns correct user" test passes while a leak reaches production.
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

When the full workflow applies, canonical schemas live in their trigger-specific references:

- `references/templates.md`: applicability check, compact design/test plan, blocking/non-blocking open questions, and the final verification summary;
- `references/risk-assessment-and-treatment.md`: compact/full risk records and the high-risk user decision record;
- `references/state-transitions.md`: state-transition table and applicable-category coverage;
- `references/migration-and-backfill.md`: migration/backfill plan template.

Do not duplicate or improvise alternate schemas in the core. Load each template once and reuse it.

Even when the full workflow is skipped, verification before any requested push is proportionate and mandatory: compile/lint/test affected code or configuration, or run repository-provided formatting/link/document checks for docs. If required checks cannot run locally, use approved CI/remote validation when available, state the exact evidence gap, and do not claim verification. Do not push with a material unverified gap unless repository policy permits it and the user explicitly accepts it.

## Structure note

If this file exceeds 300 lines, move additional workflow detail to references. Keep this entry point a router with activation rules, load triggers, hard safety contracts, and gates.
