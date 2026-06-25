<!-- markdownlint-disable MD013 -->

# Provider: GitHub Enterprise / Hyperspace AI Review Bot

## Identity

- Provider name: `ghe-pr-bot`
- Bot family: Hyperspace AI review bot / Enterprise PR-Bot
- API base: Enterprise host `/api/v3` (for known Concur repos: `https://github.concur.com/api/v3`)
- Review trigger issue comment: `/review`
- Session prefix: `ai-pr-review-loop-ghe-pr-bot-<PR>-<timestamp>`

## Preflight Rules

Unresolved thread means a root inline comment has no threaded reply. GHE inline discussion APIs can be inconsistent; if the user supplies a `#discussion_r...` URL, treat it as proof the inline discussion exists even if a relative `gh api /repos/...` endpoint returns 404.

Readiness signal is a current-head/current-epoch bot comment indicating the PR is good enough / has no actionable findings. This provider does **not** use formal GitHub `APPROVED` reviews as its ready signal.

Accept comment text only when it is from the Hyperspace/PR-Bot identity and clearly says one of:

- `good enough`
- `no actionable findings`
- `ready to merge`
- `LGTM`
- `approved` in a sentence that is not part of a control panel or command list

Exclude PR-Bot control-panel comments from approval detection. They contain review-ish words and create false approvals.

## APIs

Derive or set:

```bash
GHE_API="${API_BASE:-https://github.concur.com/api/v3}"
```

Always prefer full Enterprise API URLs:

```bash
gh api "$GHE_API/repos/$OWNER_REPO/pulls/$PR/comments" --paginate --slurp | jq '[.[][]]' > "$INLINE_COMMENTS_JSON"
gh api "$GHE_API/repos/$OWNER_REPO/issues/$PR/comments" --paginate --slurp | jq '[.[][]]' > "$ISSUE_COMMENTS_JSON"
gh pr view "$PR" --json reviews,comments,statusCheckRollup,headRefOid > "$PR_VIEW_JSON"
```

Reply inline:

```bash
gh api -X POST "$GHE_API/repos/$OWNER_REPO/pulls/$PR/comments/$COMMENT_ID/replies" -f body="$BODY"
```

Trigger review:

```bash
gh api -X POST "$GHE_API/repos/$OWNER_REPO/issues/$PR/comments" -f body="/review" >/dev/null
```

## Wait Rules

Poll for a new review or new root inline comments after trigger epoch. Do not post multiple `/review` comments in rapid succession.

## Finding Sources

Classify:

- root inline comments created after trigger;
- older root inline comments with no threaded reply;
- actionable review-body bullets if the provider posts them outside inline comments.

## Deferral Policy

Do not write `deferred`, `follow-up`, or `will address later` unless a concrete issue URL is created in the same action. If it is not worth creating an issue, classify it as out-of-scope or false positive.

## Feedback

If the bot comment exposes feedback checkboxes or structured feedback controls, mark them according to quality:

- actionable defect: helpful/valid;
- false positive/stale: not helpful/incorrect;
- out of scope: out-of-scope if available, otherwise not helpful.

Use `FEEDBACK_LOG` to avoid duplicate feedback.
