# Templates

## Applicability check (produce at start of issue/story work)

```markdown
## Test-first design applicability

- Full workflow needed? yes/no
- Reason:
- If no, why safe to skip:
```

## Design/test plan (produce before coding when full workflow applies)

```markdown
## Design/test plan

### Evidence grounding

- Repository/workdir and local instructions inspected:
- Issue, acceptance criteria, contracts, and non-goals inspected:
- Relevant source, tests, schemas, migrations, configuration, and runbooks inspected:
- Current behavior/history/runtime evidence:
- For bugs, reproduction and root-cause evidence:
- Material evidence gaps:

### Goal

### Non-goals

### Invariants

### Happy paths

### Unhappy paths

### Risk assessment

Use the compact record only for low/medium risks with high confidence and undisputed materiality/reachability:

```text
Risk ID:
Evidence sources:
Edge case / transition:
Violated invariant and direct consequence:
Impact / exposure / inherent risk:
Detectability / recovery evidence:
Confidence / assumptions:
Treatment type and mechanism:
Acceptance authority / standing policy, if treatment is acceptance:
Verification evidence:
Residual risk:
```

Use the full record for high/critical/unknown risks, sensitive or disputed cases, irreversible effects, and temporary mitigations:

```text
Risk ID:
Evidence sources:
Reachable trigger and evidence:
Incorrect behavior / transition:
Violated invariant and direct consequence:
Impact / material scope / reversibility:
Exposure:
Detectability:
Recovery or explicit irreversibility:
Confidence and evidence gaps:
Inherent risk:
Removal option / authoritative boundary / replacement risks:
Mitigation controls / dimensions changed:
Treatment selected and authorized owner:
Verification evidence:
Residual risk:
Unknowns and blocking status:
Temporary mitigation infeasibility rationale:
Temporary mitigation owner / review date / monitoring / permanent-treatment path:
User decision required:
```

For each high/critical item: what evidence would lower the rating?
For each low item: what assumption, if false, would raise it?
Unknowns that could affect an invariant: resolved, or why implementation is blocked.
Removal claim: eliminated causal link, authoritative boundary/evidence, and replacement risks.
Mitigation: risk dimension reduced, rationale, and remaining residual risk.

### High-risk user feedback / decision

Complete and present before implementation or the hazardous action for every high/critical risk and potentially-high unknown. If discovered mid-work, pause before further affected mutation:

- Risk ID, failure chain, violated invariant, consequence, and confidence:
- Evidence that would lower or resolve the risk:
- Removal option considered, trade-offs, and replacement risks:
- Mitigation option considered, dimension reduced, and residual risk:
- Recommendation and rationale:
- Recovery/rollback plan, or explicit irreversibility plus prevention/containment/incident response:
- Authorized residual-risk acceptance owner:
- Containment already applied, or none:
- Containment authorization/task/policy/runbook:
- Rollback/restoration handle and read-back verification:
- User decision required, or why existing authorization is sufficient:

If unsure, ask the user inline with concrete options and a recommendation; do not assume the user's requirements, authority, or risk tolerance. If no answer is available and irreversible harm is possible, make no new mutation or external dispatch, preserve evidence, and block the hazardous action. Enter another default-deny state only when an existing policy/runbook authorizes that exact transition.

### State-transition table

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

### Migration/backfill behavior

### Tests to write first

### Open questions

| Question | Blocking or non-blocking | Evidence / gap | Material invariant or trade-off affected | Authorized reversible default, if non-blocking | Test / risk ID | Resolution / user decision |
|---|---|---|---|---|---|---|
```

If some sections do not apply, say why.

## Verification summary (produce when finished)

```markdown
## Evidence grounding
- material invariant / reachability / severity claim → inspected source, test, contract, schema, history, or runtime evidence
- unresolved evidence gap → affected risk/open question → blocking status

## Acceptance criteria trace
- Criterion → implementation artifact → test/schema/doc validation

## Edge cases covered
- edge case / transition → expected behavior → test or validation

## Risk verification
- risk ID / assessment form (compact or full) → evidence sources → inherent risk → treatment type/mechanism → treatment evidence → verification evidence → residual risk
- low/medium compact risk → materiality/reachability confidence → detection/recovery evidence → assumptions
- removal → eliminated causal link → authoritative boundary/evidence → replacement risks assessed
- mitigation → likelihood/impact/detectability/recovery dimension changed → rationale → residual risk
- temporary mitigation → infeasibility rationale → authorized owner → review/expiry → monitoring → permanent-treatment path
- acceptance → authorized owner or standing policy → accepted residual risk
- high/critical risk → negative test → detection signal → recovery/rollback validation, or explicit irreversibility plus prevention/containment/incident-response validation
- unknown/open question → blocking status → resolved evidence, or authorized non-blocking default → test/risk ID → resolution or implementation blocker

## State-transition coverage verification
- applicable category → scenarios covered or evidence that category is impossible → risk IDs/tests

## High-risk communication and decisions
- risk ID → violated invariant/consequence communicated before implementation or hazardous action → options considered → recommendation
- containment already applied → exact authorization/runbook → rollback/restoration handle → read-back verification
- residual risk and detection/recovery or irreversibility/incident-response plan communicated
- decision requested or authorization relied upon → residual risk accepted by authorized owner

## Validation
- command outputs

## Review loop findings
- finding → missing design rule → test added → fix
```
