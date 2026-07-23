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

When a risk trigger applies, use the compact/full risk record templates in `risk-assessment-and-treatment.md` (its `Risk record templates` section). Do not improvise an alternate schema here.

### State-transition table

When a state/transition trigger applies, use the transition table plus applicable-category coverage template in `state-transitions.md` (its `State-transition table template` section).

### Migration/backfill behavior

When a migration/backfill trigger applies, use the migration plan template in `migration-and-backfill.md` (its `Migration/backfill plan template` section).

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
