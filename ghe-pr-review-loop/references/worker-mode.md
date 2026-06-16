# Worker Mode Instructions

Do not spawn another worker. If both orchestrator and worker instructions appear relevant, worker
mode wins.

## Initialize Session Logs

Before any other action, clear the score and quality logs for this session. This ensures scores
from a previous run or crashed session never contaminate the current run's trend check.

```bash
SCORES_LOG="/tmp/${SESSION_ID:-ghe-pr-review-loop}-scores.jsonl"
QUALITY_LOG="/tmp/${SESSION_ID:-ghe-pr-review-loop}-quality.jsonl"
> "$SCORES_LOG"
> "$QUALITY_LOG"
echo "Initialized session logs: $SCORES_LOG $QUALITY_LOG"
```

## Rehydrate Current State

```bash
cd "$WORKTREE"
git status --short --branch
gh pr view "$PR" --json number,title,headRefName,headRefOid,baseRefName,comments,reviews,statusCheckRollup
```

Fetch inline comments with the full GHE API URL:

```bash
gh api "$GHE_API/repos/$OWNER_REPO/pulls/$PR/comments" --paginate \
  | jq -r '.[] | "ID=\(.id) reply_to=\(.in_reply_to_id // "root") user=\(.user.login) path=\(.path // "") line=\(.line // "") created=\(.created_at)\nBODY=\(.body | split("\n")[0])\n---"'
```

## Round Score: Check Trend Before Acting

At the start of every round after the first, read the score log and halt if finding quality is
declining. The score log lives at `/tmp/<SESSION_ID>-scores.jsonl` — one JSON line per completed
round, appended at the end of each round. It is session-scoped and PR-specific.

A declining trend means the bot is producing lower-quality findings than the previous round.
Zero findings is a perfect score (1.0) and exits via the approval gate before reaching this check.

```bash
SCORES_LOG="/tmp/${SESSION_ID:-ghe-pr-review-loop}-scores.jsonl"
if [ -f "$SCORES_LOG" ] && [ "$(wc -l < "$SCORES_LOG")" -ge 2 ]; then
  python3 - "$SCORES_LOG" <<'PY'
import json, sys

lines = [l for l in open(sys.argv[1]) if l.strip()]
prev, last = json.loads(lines[-2]), json.loads(lines[-1])

prev_q = prev["avg_quality"]
last_q = last["avg_quality"]
declining = last_q < prev_q

print(f"SCORE_TREND={'declining' if declining else 'ok'}  "
      f"prev_avg_quality={prev_q:.3f}  last_avg_quality={last_q:.3f}")

if declining:
    sys.exit(1)
PY
  if [ $? -ne 0 ]; then
    cat > "$HANDOFF" <<EOF
Stopped: finding quality declined round-over-round — further reviews are unlikely to produce
high-quality findings. Human review recommended before continuing.
Score log:
$(cat "$SCORES_LOG")
EOF
    exit 0
  fi
fi
```

## Preflight: Existing Comments and Approval Gate

Use this decision table before any review trigger. Do not improvise a different order:

| State | Action |
| --- | --- |
| Existing root inline comments have no threaded reply | Do **not** trigger a review. Treat those comments as the selected comment set and fix/reply them first. |
| No unaddressed root inline comments, and a fresh comment-based approval/no-action signal exists | Do **not** trigger a review. Write HANDOFF and stop. |
| No unaddressed root inline comments, and no fresh approval/no-action signal exists | Trigger one new review. |

Approval signal is comment-based: a top-level PR issue comment or PR review body that clearly
indicates approval/no further action for the current head — e.g. `approved`, `lgtm`, `looks good`,
`no actionable findings`, `no changes requested`. Do not treat stale approvals (before the current
head commit) as a gate.

```bash
INLINE_COMMENTS_JSON="/tmp/${SESSION_ID:-ghe-pr-review-loop}-inline-comments-preflight.json"
ISSUE_COMMENTS_JSON="/tmp/${SESSION_ID:-ghe-pr-review-loop}-issue-comments-preflight.json"
PR_VIEW_JSON="/tmp/${SESSION_ID:-ghe-pr-review-loop}-pr-view-preflight.json"
ACTIONABLE_COMMENTS_JSON="/tmp/${SESSION_ID:-ghe-pr-review-loop}-actionable-comments.json"

gh api "$GHE_API/repos/$OWNER_REPO/pulls/$PR/comments" --paginate --slurp \
  | jq '[.[][]]' > "$INLINE_COMMENTS_JSON"
gh api "$GHE_API/repos/$OWNER_REPO/issues/$PR/comments" --paginate --slurp \
  | jq '[.[][]]' > "$ISSUE_COMMENTS_JSON"
gh pr view "$PR" --json reviews,comments,statusCheckRollup,headRefOid > "$PR_VIEW_JSON"
HEAD_SHA=$(jq -r '.headRefOid' "$PR_VIEW_JSON")
HEAD_EPOCH=$(gh api "$GHE_API/repos/$OWNER_REPO/commits/$HEAD_SHA" | jq -r '.commit.committer.date | fromdateiso8601')

jq '
  . as $comments
  | [$comments[] as $comment
    | select($comment.in_reply_to_id == null)
    | select(([$comments[] | select(.in_reply_to_id == $comment.id)] | length) == 0)
    | {
        id: $comment.id,
        path: $comment.path,
        line: $comment.line,
        user: $comment.user.login,
        created_at: $comment.created_at,
        body: $comment.body
      }
  ]
' "$INLINE_COMMENTS_JSON" > "$ACTIONABLE_COMMENTS_JSON"

UNADDRESSED_COUNT=$(jq 'length' "$ACTIONABLE_COMMENTS_JSON")
APPROVAL_PRESENT=$(jq -r --slurpfile issue_comments "$ISSUE_COMMENTS_JSON" --argjson head_epoch "$HEAD_EPOCH" '
  def approval_text:
    (test("(?i)(not approved|not lgtm|changes requested|not ready|still needs changes)") | not)
    and test("(?i)(^|[^a-z])(approved|lgtm|looks good|no actionable findings|no changes requested)([^a-z]|$)");
  def after_current_head($timestamp):
    (($timestamp // "1970-01-01T00:00:00Z") | fromdateiso8601) >= $head_epoch;
  (([$issue_comments[0][]?
      | select(((.body // "") | contains("PR-Bot Control-Panel") | not)
          and ((.body // "") | approval_text)
          and after_current_head(.created_at))
    ] | length) > 0)
  or (([.reviews[]?
      | select(((.body // "") | approval_text) and after_current_head(.submittedAt))
    ] | length) > 0)
  | if . then "yes" else "no" end
' "$PR_VIEW_JSON")

echo "approval_present=$APPROVAL_PRESENT unaddressed_root_inline_comments=$UNADDRESSED_COUNT"

if [ "$UNADDRESSED_COUNT" -gt 0 ]; then
  REVIEW_TRIGGER_REQUIRED=no
  SELECTED_COMMENTS_REASON="existing unaddressed root inline comments"
elif [ "$APPROVAL_PRESENT" = "yes" ]; then
  HEAD_SHORT=$(git rev-parse --short HEAD)
  WORKTREE_STATUS=$(git status --short --branch)
  CI_SUMMARY=$(jq -r '(.statusCheckRollup[]? | [.name,.status,.conclusion] | @tsv)' "$PR_VIEW_JSON" 2>/dev/null || true)
  cat > "$HANDOFF" <<EOF
Completed PR review loop for #$PR.
Latest head: $HEAD_SHORT
Fixed: none
Rejected/qualified: none
Validation: not run; fresh comment-based approval/no-action signal is present and no root inline comments are unaddressed.
CI: ${CI_SUMMARY:-not checked/no checks in preflight}
Review-fix verification:
- Current top-level PR comments fetched: yes
- Current inline PR comments fetched through full GHE API: yes
- Each current root inline comment has an inline reply: yes
- Each valid finding maps to a fix and test/validation: not applicable
- Each rejected finding has evidence in the reply: not applicable
- CI is green on latest commit: not checked in approval no-op path
Worktree:
$WORKTREE_STATUS
EOF
  exit 0
else
  REVIEW_TRIGGER_REQUIRED=yes
  SELECTED_COMMENTS_REASON="none selected before trigger"
fi
```

If `REVIEW_TRIGGER_REQUIRED=no`, skip [Trigger a New Bot Review](#trigger-a-new-bot-review) and
[Wait for Review Completion](#wait-for-review-completion). Proceed directly to
[Classify and Fix Findings](#classify-and-fix-findings) using `ACTIONABLE_COMMENTS_JSON`.

## Trigger a New Bot Review

Only run this section when preflight set `REVIEW_TRIGGER_REQUIRED=yes`.

```bash
test "${REVIEW_TRIGGER_REQUIRED:-}" = "yes" || { echo "Internal workflow error: trigger section reached with REVIEW_TRIGGER_REQUIRED=${REVIEW_TRIGGER_REQUIRED:-unset}" >&2; exit 2; }

CONTROL_COMMENT_ID=$(
  gh api "$GHE_API/repos/$OWNER_REPO/issues/$PR/comments" --paginate \
    | jq -r '.[] | select((.body // "") | contains("PR-Bot Control-Panel") and contains("🔍 Review")) | .id' \
    | tail -n 1
)
test -n "$CONTROL_COMMENT_ID" || { echo "No PR bot control-panel comment found" >&2; exit 1; }
```

Clear the review checkbox first:

```bash
CONTROL_PANEL_FILE="/tmp/${SESSION_ID:-ghe-pr-review-loop}-control-panel.md"
gh api "$GHE_API/repos/$OWNER_REPO/issues/comments/$CONTROL_COMMENT_ID" \
  | jq -r '.body' > "$CONTROL_PANEL_FILE"

CONTROL_PANEL_FILE="$CONTROL_PANEL_FILE" python3 - <<'PY'
import os
from pathlib import Path
path = Path(os.environ['CONTROL_PANEL_FILE'])
body = path.read_text()
lines = []
for line in body.splitlines():
    if '🔍 Review' in line:
        line = line.replace('- [x]', '- [ ]').replace('- [X]', '- [ ]')
    lines.append(line)
path.write_text('\n'.join(lines) + ('\n' if body.endswith('\n') else ''))
PY

gh api -X PATCH "$GHE_API/repos/$OWNER_REPO/issues/comments/$CONTROL_COMMENT_ID" \
  -f body="$(cat "$CONTROL_PANEL_FILE")" >/dev/null

# The bot fires on an unchecked→checked edge transition, not on state.
# Without this pause the re-check arrives before GHE has recorded the unchecked state.
sleep 3
```

Then re-check it:

```bash
CONTROL_PANEL_FILE="/tmp/${SESSION_ID:-ghe-pr-review-loop}-control-panel.md"
CONTROL_PANEL_FILE="$CONTROL_PANEL_FILE" python3 - <<'PY'
import os
from pathlib import Path
path = Path(os.environ['CONTROL_PANEL_FILE'])
body = path.read_text()
lines = []
for line in body.splitlines():
    if '🔍 Review' in line:
        line = line.replace('- [ ]', '- [x]')
    lines.append(line)
path.write_text('\n'.join(lines) + ('\n' if body.endswith('\n') else ''))
PY

TRIGGER_EPOCH=$(date -u +%s)
gh api -X PATCH "$GHE_API/repos/$OWNER_REPO/issues/comments/$CONTROL_COMMENT_ID" \
  -f body="$(cat "$CONTROL_PANEL_FILE")" >/dev/null
```

## Wait for Review Completion

Poll for a new review or new root inline comments after `TRIGGER_EPOCH`. After the wait, build the
actionable comment set from root inline comments created after the trigger plus older root comments
with no replies:

```bash
for i in {1..90}; do
  gh pr view "$PR" --json reviews,statusCheckRollup,headRefOid > /tmp/pr-view.json
  NEW_REVIEW_COUNT=$(jq --argjson trigger "$TRIGGER_EPOCH" '[.reviews[]? | select((.submittedAt | fromdateiso8601) >= $trigger)] | length' /tmp/pr-view.json)
  NEW_INLINE_COUNT=$(gh api "$GHE_API/repos/$OWNER_REPO/pulls/$PR/comments" --paginate --slurp | jq --argjson trigger "$TRIGGER_EPOCH" '[.[][]? | select(.in_reply_to_id == null and ((.created_at | fromdateiso8601) >= $trigger))] | length')
  echo "new_reviews=$NEW_REVIEW_COUNT new_inline_roots=$NEW_INLINE_COUNT"
  if [ "$NEW_REVIEW_COUNT" -gt 0 ] || [ "$NEW_INLINE_COUNT" -gt 0 ]; then
    sleep 20
    break
  fi
  sleep 10
done

# If the loop exhausted all iterations without a new review, escalate rather than fall through.
if [ "$NEW_REVIEW_COUNT" -eq 0 ] && [ "$NEW_INLINE_COUNT" -eq 0 ]; then
  WORKTREE_STATUS=$(git status --short --branch)
  cat > "$HANDOFF" <<EOF
Blocker: no new review or inline comments appeared within 15 minutes of triggering the bot.
The checkbox was toggled (clear → re-check) but the bot did not respond. Possible causes:
- Bot service is down or the webhook did not fire.
- The control-panel comment ID is wrong (check CONTROL_COMMENT_ID).
- The 3-second pause between uncheck and re-check was insufficient for this GHE instance.
Latest head: $(git rev-parse --short HEAD)
Fixed: none
Rejected/qualified: none
Validation: not run
CI: not checked
Worktree:
$WORKTREE_STATUS
EOF
  exit 1
fi

INLINE_COMMENTS_JSON="/tmp/${SESSION_ID:-ghe-pr-review-loop}-inline-comments.json"
# --paginate emits one JSON array per page; --slurp wraps pages so jq can flatten them.
gh api "$GHE_API/repos/$OWNER_REPO/pulls/$PR/comments" --paginate --slurp \
  | jq '[.[][]]' > "$INLINE_COMMENTS_JSON"

ACTIONABLE_COMMENTS_JSON="/tmp/${SESSION_ID:-ghe-pr-review-loop}-actionable-comments.json"
jq --argjson trigger "$TRIGGER_EPOCH" '
  . as $comments
  | [$comments[] as $comment
    | select($comment.in_reply_to_id == null)
    | select(
        (($comment.created_at | fromdateiso8601) >= $trigger)
        or (([$comments[] | select(.in_reply_to_id == $comment.id)] | length) == 0)
      )
    | {
        id: $comment.id,
        path: $comment.path,
        line: $comment.line,
        user: $comment.user.login,
        created_at: $comment.created_at,
        body: $comment.body
      }
  ]
' "$INLINE_COMMENTS_JSON" > "$ACTIONABLE_COMMENTS_JSON"

jq '.' "$ACTIONABLE_COMMENTS_JSON"
if [ "$(jq 'length' "$ACTIONABLE_COMMENTS_JSON")" -eq 0 ]; then
  HEAD_SHORT=$(git rev-parse --short HEAD)
  WORKTREE_STATUS=$(git status --short --branch)
  CI_SUMMARY=$(jq -r '(.statusCheckRollup[]? | [.name,.status,.conclusion] | @tsv)' /tmp/pr-view.json 2>/dev/null || true)
  cat > "$HANDOFF" <<EOF
Completed PR review loop for #$PR.
Latest head: $HEAD_SHORT
Fixed: none
Rejected/qualified: none
Validation: not run; no selected root inline comments required action after the review trigger.
CI: ${CI_SUMMARY:-not checked/no checks available}
Review-fix verification:
- Current top-level PR comments fetched: yes
- Current inline PR comments fetched through full GHE API: yes
- Each current root inline comment has an inline reply: not applicable; no selected comments
- Each valid finding maps to a fix and test/validation: not applicable
- Each rejected finding has evidence in the reply: not applicable
- CI is green on latest commit: not checked in no-op path
Worktree:
$WORKTREE_STATUS
EOF
  exit 0
fi
```

If `ACTIONABLE_COMMENTS_JSON` is empty the snippet above writes HANDOFF and exits. Do not run
validation, commit, push, or post replies for an empty selected comment set.

## Triage Findings Before Acting

**Do not assume the reviewer is correct.** For every comment in `ACTIONABLE_COMMENTS_JSON`, read
the actual code at the cited file and line before forming any opinion about the finding. The bot
makes factual errors: wrong file, stale diff line, misread context, hallucinated invariant. Treating
its output as ground truth wastes tokens on spurious fixes and produces incorrect inline replies.

For each comment, before any classification decision:

1. **Read the cited location.** Open `path` at `line` in the worktree. Read enough surrounding
   context to understand what the code actually does — at minimum the enclosing function or block.
2. **Verify the factual claim.** Does the code actually exhibit the problem the comment describes?
   If the comment says "this function doesn't handle null" — does it? Check. If it says "this import
   is unused" — is it? Grep. Do not accept the claim without evidence.
3. **Score the finding** before classifying:
   - **Verified** — the claim is factually accurate against the current code.
   - **Unverified** — the claim cannot be confirmed by reading the code (e.g. references a
     deleted line, wrong file, or behavior that doesn't exist in this diff).
   - **Contradicted** — the code demonstrably does the opposite of what the comment claims.
4. Only **Verified** findings proceed to classification. Unverified and contradicted findings are
   immediately classified as false positives — record the evidence in the reply plan now.

For Verified findings, also ask before classifying as actionable:
- **Is the fix safe?** Would it change behavior at other call sites, break an existing contract, or
  contradict a repo rule the bot doesn't know about? If no safe fix exists, treat as out-of-scope.
- **Has this already been rebutted?** If a prior thread on this PR already cites evidence against
  this finding and the bot repeated it, reply with the same evidence — do not make a new code change.

Low-signal comment patterns that warrant extra skepticism before verification:
- Comment body under ~60 characters with no code reference
- Style/naming suggestions on files not in the diff
- Claims about behavior that require runtime knowledge the bot doesn't have
- Repetition of a comment already rebutted in a prior thread on the same PR

**Never open a file, search for a pattern, run a command, or draft a fix until triage is
complete for all comments.** Batch the reads first, then score, then proceed.

Initialize the quality log before the triage pass — one entry per finding, fed into the round score:

```bash
QUALITY_LOG="/tmp/${SESSION_ID:-ghe-pr-review-loop}-quality.jsonl"
# Clear findings from the previous round — each round is scored independently.
# (Session-level initialization already cleared this at startup; this clears between rounds.)
> "$QUALITY_LOG"
# After scoring each comment, append one line:
#   Verified actionable defect (fixed):
#     echo '{"id":<COMMENT_ID>,"quality":1.0,"scope_creep":false}' >> "$QUALITY_LOG"
#   Verified actionable cleanup (fixed):
#     echo '{"id":<COMMENT_ID>,"quality":0.7,"scope_creep":false}' >> "$QUALITY_LOG"
#   Out of scope (real finding, wrong PR):
#     echo '{"id":<COMMENT_ID>,"quality":0.3,"scope_creep":<true|false>}' >> "$QUALITY_LOG"
#   False positive / unverified / contradicted:
#     echo '{"id":<COMMENT_ID>,"quality":0.0,"scope_creep":false}' >> "$QUALITY_LOG"
```

**Scope creep flag**: set `scope_creep: true` on any finding where acting on it would touch files
outside the current PR diff, refactor adjacent code not part of this change, or address a systemic
issue that belongs in a separate PR. Do not silently file these as follow-up issues — they must
surface in the HANDOFF as a human decision. A finding can be `quality: 0.3` (out of scope) and
`scope_creep: true` simultaneously.

**If every comment scored Unverified or Contradicted** (no Verified findings at all): post
false-positive replies immediately for each, write HANDOFF, and exit. Do not run validation,
commit, or push — there is nothing to fix. This is a clean no-op loop, not a failure.

## Classify and Fix Findings

Every selected root inline comment gets exactly one inline reply — no exceptions. Classification
determines the reply content, not whether a reply is sent.

| Classification | Action | Reply required? |
| --- | --- | --- |
| Actionable defect | Fix with tests | Yes — after commit/push, before CI wait |
| Actionable cleanup | Fix if low risk and in-scope | Yes — after commit/push, before CI wait |
| False positive | No code change; prepare rebuttal with evidence | Yes — immediately after classification |
| Out of scope | No code change; create durable issue if repo rules require | Yes — immediately after classification |

For each selected root inline comment:

1. Apply the triage score from [Triage Findings Before Acting](#triage-findings-before-acting).
   Unverified and contradicted findings are already classified as false positives — skip to step 6.
2. Identify the invariant behind the verified finding.
3. Classify it as one of the four categories above.
4. For actionable findings, search adjacent/global instances of the same defect class.
5. Add or update tests or documented validation.
6. Patch code.
7. Record the intended inline reply in a local reply plan with:
   - `COMMENT_ID`
   - classification
   - files/tests changed, rebuttal evidence, or skip rationale
   - validation command (actionable) or `n/a` (non-actionable)
   - expected final reply text without a commit SHA yet
8. Do **not** post inline replies yet, including false-positive or out-of-scope replies. Batch
   all replies after final validation/commit/push/CI verification to avoid mixed state and duplicate
   responses.

After all classifications are complete:

1. Post inline replies for false-positive and out-of-scope findings immediately (see
   [Reply Inline for Non-Actionable Findings](#reply-inline-for-non-actionable-findings-before-push)).
2. Run focused validation for actionable findings.
3. Run repo-required final validation.
4. Commit/amend and push.
5. Capture `HEAD_SHA=$(git rev-parse --short HEAD)`.
6. Post inline replies for actionable findings immediately using `HEAD_SHA` and `CI: pending` (see
   [Reply Inline for Actionable Findings](#reply-inline-for-actionable-findings-after-commit-and-push)).
7. Wait for CI completion and determine whether CI is green. Treat `SUCCESS` and intentionally
   skipped checks as acceptable; treat `FAILURE`, `CANCELLED`, `TIMED_OUT`, missing required
   checks, or still-pending checks as not green.
8. If CI is not green, investigate and fix CI. If unable to fix, write HANDOFF with the blocker.

## Reply Inline for Non-Actionable Findings (Before Push)

Post replies for false-positive and out-of-scope findings immediately after classification — before
commit, push, or CI. These replies carry no SHA reference and are not blocked by CI state.

```bash
HEAD_SHA=$(git rev-parse --short HEAD)
# False positive:
gh api -X POST "$GHE_API/repos/$OWNER_REPO/pulls/$PR/comments/$COMMENT_ID/replies" \
  -f body="Not changed. This finding is incorrect because <evidence>. <Why the proposed change is harmful, deprecated, or conflicts with an invariant>." >/dev/null

# Out of scope:
gh api -X POST "$GHE_API/repos/$OWNER_REPO/pulls/$PR/comments/$COMMENT_ID/replies" \
  -f body="Not addressed in this PR — this change is outside the scope of the current diff. Tracked in <issue link or 'will create a follow-up issue'>." >/dev/null
```

## Push and Wait for CI

After posting non-actionable replies and completing all fixes, commit and push. Do not push with a
dirty worktree:

```bash
git status --short --branch
git add <relevant-files>
# Commit or amend according to current branch history and user/repo expectations.
git commit --amend --no-edit  # only when intentionally continuing an existing review-fix commit
# or: git commit -m "Address PR review feedback"
git status --short --branch
git push --force-with-lease  # only if amending an already-pushed commit
# or: git push
```

Poll CI and compute CI state:

```bash
CI_VIEW_JSON="/tmp/${SESSION_ID:-ghe-pr-review-loop}-ci.json"
for i in {1..60}; do
  gh pr view "$PR" --json statusCheckRollup,headRefOid > "$CI_VIEW_JSON"
  jq -r '.headRefOid as $sha | "head=\($sha)", (.statusCheckRollup[] | [.name,.status,.conclusion] | @tsv)' "$CI_VIEW_JSON"
  if jq -e '(.statusCheckRollup | length) > 0 and all(.statusCheckRollup[]; .status == "COMPLETED")' "$CI_VIEW_JSON" >/dev/null; then
    break
  fi
  sleep 10
done

CI_GREEN=$(jq -r '
  if ((.statusCheckRollup | length) > 0
      and all(.statusCheckRollup[]; .status == "COMPLETED")
      and all(.statusCheckRollup[]; (.conclusion == "SUCCESS") or (.conclusion == "SKIPPED") or (.conclusion == "NEUTRAL")))
  then "yes" else "no" end
' "$CI_VIEW_JSON")

echo "CI green: $CI_GREEN"
```

If `CI_GREEN` is `no`, inspect failed/pending checks and fix them before posting "Fixed" inline
replies. If CI cannot be fixed in this worker run, write HANDOFF with the blocker and exit without
claiming the findings are fixed.

## Reply Inline for Actionable Findings (After Commit and Push)

Post replies for actionable findings immediately after push — do not wait for CI. Use `CI: pending`
in the reply body. Reviewers can see the fix and follow CI themselves; holding replies until CI
completes delays visibility and wastes tokens polling before anyone can act on the result.
Do not use top-level PR comments for inline review findings.

**Reply body rules:**
- 2–4 sentences maximum. Reviewers read dozens of these; brevity is respect.
- Describe *what* changed in one sentence — the approach, not the line numbers.
- Summarize validation in one clause: tool name + pass/fail count, not raw output.
- Never paste raw command output, build logs, bundle sizes, license tables, or test runner
  stdout into the reply body. If a reviewer needs that detail they can check CI.
- CI state at reply time is always `pending` — replies go out before the CI wait. Do not hold the
  reply to report a final CI state.

```bash
HEAD_SHA=$(git rev-parse --short HEAD)
# Fixed finding — keep body to 2-4 sentences; CI state is "pending" at reply time:
gh api -X POST "$GHE_API/repos/$OWNER_REPO/pulls/$PR/comments/$COMMENT_ID/replies" \
  -f body="Fixed in $HEAD_SHA. <One sentence: what approach was taken and why it addresses the finding>. Validation: <tool(s)> passed (e.g. '35/35 tests, lint, build, boundary check'). CI: pending." >/dev/null
```

**Good reply examples** (from real PRs in this repo):

Fix with a design decision explained:
> Fixed in 58658a3 by making the pagination decision explicit in `hasPotentialNextPage()`. The
> current Service Insights collection response exposes `count`, `limit`, and `offset`, but not
> `total`/`has_more`, so an exact-multiple last page cannot be distinguished without changing the
> API contract. The code now documents this as an optimistic next-page signal rather than
> accidental `count === limit` logic, and the frontend test covers explicit target page URL
> semantics. Validation: `make frontend-check`, `make check`, and local `make e2e-smoke` passed.

Fix that also caught the same defect class elsewhere:
> Fixed in 58658a3. React comparison tables now include environment/entity/metric in the
> accessible label. I also fixed the same defect class in the server-rendered fallback template.
> Added React and Python assertions for the unique labels. Validation: `make frontend-check` and
> `make check` passed.

Fix with a nuanced explanation of why the approach differs from the suggestion:
> Partially addressed in 2e51bad. The specific claim that a cleared Mantine Select resends the
> old URL parameter is not accurate for this form shape: the forms use a path-only `action`, so
> omitted GET fields clear rather than preserving the old query string. The real adjacent bug was
> stale uncontrolled form state when URL-derived controls change without a full remount. I fixed
> that by deriving controls from the current `window.location.search` and keying the filter forms
> on the URL-derived controls so inputs remount with the current URL values. Added rerender
> coverage for URL changes without remounting providers. Validation: `make frontend-check` and
> `make check` passed.

False positive with specific evidence:
> Not changed; this comment is incorrect for the Vite 8/Rolldown version in this branch.
> Installed `vite/dist/node/index.d.ts` marks `rollupOptions` as deprecated and defines
> `rolldownOptions`; Vite runtime code aliases deprecated `rollupOptions` to `rolldownOptions`
> and reads `config.build.rolldownOptions.output`. The CI/local build output also proves the
> option is active: it emits `rolldown-runtime`, `vendor-react`, `vendor-mantine`, `vendor-query`,
> and `vendor-charts` chunks. Switching to `rollupOptions` would move to the deprecated API.

Python fix with boundary test that pins the correct limit:
> Rebuttal plus clarification in 1417ddf. The intended contract is "at most 100
> registration-scoped discovery queries are allowed"; therefore `> MAX_REGISTRATION_SCOPED_DISCOVERY_QUERIES`
> is the correct guard. `>=` would reject exactly 100 and allow only 99. I added
> `test_run_once_allows_maximum_registration_scoped_discovery_queries` to pin that 100 is allowed,
> while the existing 101-scope test proves 101 is rejected before source calls. Validation:
> focused discovery/orchestrator tests and `make check` passed.

**Bad reply body — do not do this:**
> Fixed in 60259ac. Split URL generation... Validation: Warning: Node.js 24.15.0 is active;
> .nvmrc requests 24.14.1. Use fnm, nvm... PNPM is not installed... ✓ 1438 modules transformed...
> dist/assets/vendor-charts-DXGi4DKJ.js 1,129.35 kB │ gzip: 375.23 kB... CI: green.
>
> (Raw build output dumped verbatim. Reviewer must scroll past hundreds of lines to find the fix
> description. Never do this — summarize validation in one clause.)

After posting replies, refetch inline comments and verify every selected root comment has a reply.
Treat any missing reply as a failed review-fix verification, post the missing reply, and re-run
this check:

```bash
POST_REPLY_COMMENTS_JSON="/tmp/${SESSION_ID:-ghe-pr-review-loop}-post-reply-comments.json"
gh api "$GHE_API/repos/$OWNER_REPO/pulls/$PR/comments" --paginate --slurp \
  | jq '[.[][]]' > "$POST_REPLY_COMMENTS_JSON"

REPLY_VERIFICATION_JSON="/tmp/${SESSION_ID:-ghe-pr-review-loop}-reply-verification.json"
jq -n \
  --slurpfile selected "$ACTIONABLE_COMMENTS_JSON" \
  --slurpfile comments "$POST_REPLY_COMMENTS_JSON" '
  ($selected[0]) as $selected_comments
  | ($comments[0]) as $all_comments
  | [
      $selected_comments[]
      | . as $root
      | {
          id: $root.id,
          has_reply: (([$all_comments[] | select(.in_reply_to_id == $root.id)] | length) > 0)
        }
    ]
' > "$REPLY_VERIFICATION_JSON"

jq '.' "$REPLY_VERIFICATION_JSON"
jq -e 'all(.[]; .has_reply == true)' "$REPLY_VERIFICATION_JSON" >/dev/null
```

## Append Round Score

After reply verification passes, compute the round's average finding quality and append to the
score log. The quality weights come from the per-finding entries written to `QUALITY_LOG` during
the triage pass (1.0 = actionable defect, 0.7 = cleanup, 0.3 = out of scope, 0.0 = false positive).

```bash
SCORES_LOG="/tmp/${SESSION_ID:-ghe-pr-review-loop}-scores.jsonl"
QUALITY_LOG="/tmp/${SESSION_ID:-ghe-pr-review-loop}-quality.jsonl"
ROUND_NUM=$(( $(wc -l < "$SCORES_LOG" 2>/dev/null || echo 0) + 1 ))

python3 - "$QUALITY_LOG" "$SCORES_LOG" "$ROUND_NUM" "${CI_GREEN:-unknown}" <<'PY'
import json, sys
quality_log, scores_log, round_num, ci = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]

findings = [json.loads(l) for l in open(quality_log) if l.strip()]
total = len(findings)
avg_quality = round(sum(f["quality"] for f in findings) / total, 3) if total else 1.0
scope_creep = [f["id"] for f in findings if f.get("scope_creep")]

entry = {
    "round": round_num,
    "total": total,
    "avg_quality": avg_quality,
    "scope_creep_ids": scope_creep,
    "ci": ci,
}
with open(scores_log, "a") as fh:
    fh.write(json.dumps(entry) + "\n")

print(f"Round {round_num} score: avg_quality={avg_quality:.3f} total={total} "
      f"scope_creep={len(scope_creep)} ci={ci}")
PY
```

After appending the round score, emit a human-readable progress block so the orchestrator and user
can follow along without tailing the log:

```bash
python3 - "$SCORES_LOG" <<'PY'
import json, sys
lines = [l for l in open(sys.argv[1]) if l.strip()]
e = json.loads(lines[-1])
q = e["avg_quality"]
trend = ""
if len(lines) >= 2:
    prev_q = json.loads(lines[-2])["avg_quality"]
    arrow = "▲" if q > prev_q else ("▼" if q < prev_q else "→")
    trend = f"  trend={arrow}{abs(q - prev_q):.2f}"
print(f"\n=== Round {e['round']} complete ===")
print(f"  findings   : {e['total']}")
print(f"  avg quality: {q:.2f}{trend}")
print(f"  scope creep: {len(e['scope_creep_ids'])} finding(s)")
print(f"  ci         : {e['ci']}")
PY
```

## Handoff File

Always write `HANDOFF` before exiting. Generate the round summary table from `SCORES_LOG`:

```bash
python3 - "$SCORES_LOG" <<'PY'
import json, sys
lines = [l for l in open(sys.argv[1]) if l.strip()]
entries = [json.loads(l) for l in lines]
print("| Round | Findings | Avg quality | Scope creep | CI |")
print("| --- | --- | --- | --- | --- |")
for i, e in enumerate(entries):
    prev_q = entries[i-1]["avg_quality"] if i > 0 else None
    q = e["avg_quality"]
    arrow = ("▲" if q > prev_q else ("▼" if q < prev_q else "→")) if prev_q is not None else "—"
    print(f"| {e['round']} | {e['total']} | {q:.2f} {arrow} | {len(e['scope_creep_ids'])} | {e['ci']} |")
total_findings = sum(e["total"] for e in entries)
overall_q = round(sum(e["avg_quality"] for e in entries) / len(entries), 3) if entries else 0
trend = "improving" if len(entries) >= 2 and entries[-1]["avg_quality"] > entries[0]["avg_quality"] \
    else "declining" if len(entries) >= 2 and entries[-1]["avg_quality"] < entries[0]["avg_quality"] \
    else "stable"
print(f"\nRounds completed: {len(entries)}  Total findings: {total_findings}  Overall avg quality: {overall_q:.2f}  Trend: {trend}")
PY
```

Then write the full HANDOFF:

```text
Completed PR review loop for #<PR>.
Latest head: <sha>

## Round summary
<paste table output from above>

## Findings
Fixed: <bullets>
Rejected/qualified: <bullets>
Scope creep flagged: <none | bullet per finding with comment ID and why it would expand scope>

## Validation
<commands/results>
CI: green / failing <job>

## Review-fix verification
- Current top-level PR comments fetched: yes/no
- Current inline PR comments fetched through full GHE API: yes/no
- Each current root inline comment has an inline reply: yes/no
- Each valid finding maps to a fix and test/validation: yes/no
- Each rejected finding has evidence in the reply: yes/no
- CI is green on latest commit: yes/no
Worktree: clean / dirty <files>
```
