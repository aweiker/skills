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

### Goal

### Non-goals

### Invariants

### Happy paths

### Unhappy paths

### State-transition table

### Migration/backfill behavior

### Tests to write first

### Open questions
```

If some sections do not apply, say why.

## Verification summary (produce when finished)

```markdown
## Acceptance criteria trace
- Criterion → implementation artifact → test/schema/doc validation

## Edge cases covered
- ...

## Validation
- command outputs

## Review loop findings
- finding → missing design rule → test added → fix
```
