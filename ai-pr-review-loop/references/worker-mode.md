<!-- markdownlint-disable MD013 -->

# Shared Worker Mode

This is the provider-independent engine. Load the selected provider file before running commands.

## Session Logs

Initialize logs once per worker run:

```bash
SCORES_LOG="/tmp/${SESSION_ID:-ai-pr-review-loop}-scores.jsonl"
QUALITY_LOG="/tmp/${SESSION_ID:-ai-pr-review-loop}-quality.jsonl"
PROGRESS_LOG="/tmp/${SESSION_ID:-ai-pr-review-loop}-progress.log"
REPLIED_LOG="/tmp/${SESSION_ID:-ai-pr-review-loop}-replied.txt"
FEEDBACK_LOG="/tmp/${SESSION_ID:-ai-pr-review-loop}-feedback.txt"
> "$SCORES_LOG"
> "$QUALITY_LOG"
> "$PROGRESS_LOG"
> "$REPLIED_LOG"
> "$FEEDBACK_LOG"
```

`REPLIED_LOG` is the inline-reply idempotency ledger. Before posting any reply, check:

```bash
grep -qx "$COMMENT_ID" "$REPLIED_LOG" && echo "already replied: $COMMENT_ID" && continue
```

Append the ID only after a successful reply API call.

## Round Order

Use this exact order each round:

1. Rehydrate worktree, PR head, CI, reviews, issue comments, inline comments.
2. Run provider preflight:
   - unresolved inline/follow-up comments selected for triage;
   - current-head approval/no-actionable signal stops successfully;
   - otherwise one provider review trigger is required.
3. If triggering, post exactly one provider trigger and wait by provider rules.
4. Build the selected findings set from provider rules.
5. Read cited code and classify every finding:
   - `1.0` real actionable defect;
   - `0.7` valid cleanup but non-blocking / not necessary for this PR;
   - `0.3` out of scope;
   - `0.0` false positive/stale/wrong.
6. Append classification JSON lines to `QUALITY_LOG`.
7. Apply post-triage quality gate.
8. Reply immediately to non-actionable findings using provider reply endpoint.
9. Fix actionable findings only after the quality gate passes.
10. Run focused validation and repo-required validation.
11. Commit/push fixes.
12. Reply to fixed actionable findings with commit SHA and `CI: pending`.
13. Wait for CI. If red, investigate and hand off as blocker.
14. Append one progress line and write/update HANDOFF.
15. Stop when loop count is exhausted, provider approval is present, zero findings are present, or quality declines.

## Post-Triage Quality Gate

After classifying all findings and before code changes:

```bash
ROUND_AVG=$(python3 -c '
import json, sys
path = sys.argv[1]
items = [json.loads(l) for l in open(path) if l.strip()]
print(1.0 if not items else sum(i["quality"] for i in items) / len(items))
' "$QUALITY_LOG")
```

Stop without fixing if all selected findings are `<= 0.3` or if round average is `<= 0.5`. Reply to non-actionable findings first, then write HANDOFF. Do not fix low-value suggestions just because they are easy.

## Validation Discipline

For every real finding:

- name the invariant it violates;
- search for adjacent/global instances of the same defect class;
- add or update tests when behavior changed;
- run focused validation first;
- run the repository-required full validation before push;
- include validation commands/results in HANDOFF and inline reply.

## Reply Contract

Every finding gets exactly one outcome:

- fixed with commit SHA and validation;
- false positive with evidence;
- out of scope with scope rationale;
- blocker with exact missing data/tool/API state.

Do not say "deferred" without the provider/repo policy allowing it. If the provider requires issue URLs for deferrals, create the issue before mentioning it.

## Handoff Required Fields

```markdown
# AI PR review loop handoff

Provider: <provider>
PR: <owner/repo>#<number>
Latest head: <sha>
Exit reason: <clean | all-non-actionable | approval | quality-gate | loop-count | blocker>

## Findings

- Fixed:
- Rejected / out of scope:
- Still blocked:

## Validation

- Focused:
- Full:
- CI:

## Review-fix verification

- Inline comments fetched:
- Issue comments/reviews fetched:
- Reply ledger checked:
- Provider approval/no-actionable signal:

## Worktree

<git status --short --branch>
```
