<!-- markdownlint-disable MD013 -->

# Provider: CodeRabbit on Public GitHub

## Identity

- Provider name: `coderabbit`
- API base: `https://api.github.com`
- Bot logins: `coderabbitai`, `coderabbitai[bot]`
- Review trigger issue comment: `@coderabbitai review`
- Session prefix: `ai-pr-review-loop-coderabbit-<PR>-<timestamp>`

## Preflight Rules

Unresolved thread means:

1. root inline comment has no replies; or
2. latest reply in the thread is from CodeRabbit and does **not** clearly withdraw/accept the rebuttal.

Closure text includes case-insensitive phrases like:

- `withdrawing the comment`
- `withdrawn`
- `no changes needed`
- `review comment was wrong`
- `you're correct` / `that's correct`
- `clear and well-reasoned`

Readiness signal is the latest current-head CodeRabbit formal review state `APPROVED`. Treat that as the authoritative "ready" signal.

Do **not** treat CodeRabbit walkthrough, summary, release-note, or generic positive issue comments as approval. They are commentary only. If the latest CodeRabbit formal review on the current head is `CHANGES_REQUESTED`, continue triage even if comments sound positive.

## APIs

```bash
GH_API="${API_BASE:-https://api.github.com}"
gh api "$GH_API/repos/$OWNER_REPO/pulls/$PR/comments" --paginate --slurp | jq '[.[][]]' > "$INLINE_COMMENTS_JSON"
gh api "$GH_API/repos/$OWNER_REPO/issues/$PR/comments" --paginate --slurp | jq '[.[][]]' > "$ISSUE_COMMENTS_JSON"
gh pr view "$PR" --json reviews,comments,statusCheckRollup,headRefOid > "$PR_VIEW_JSON"
```

Reply inline:

```bash
gh api -X POST "$GH_API/repos/$OWNER_REPO/pulls/$PR/comments/$COMMENT_ID/replies" -f body="$BODY"
```

Trigger review:

```bash
gh api -X POST "$GH_API/repos/$OWNER_REPO/issues/$PR/comments" -f body="@coderabbitai review" >/dev/null
```

## Wait Rules

Poll for new CodeRabbit reviews or new root inline comments after trigger epoch. Also watch issue comments for rate/usage limits containing:

- `review limit reached`
- `rate limit`
- `usage limit`
- `more reviews will be available`

On usage limit: parse the stated availability time/duration, sleep until that time plus 30 seconds, then retry the same round. Do not hand off as `blocker` merely because the wait is long. If the provider gives no parseable duration, sleep 30 minutes and retry. On repeated usage limits, continue sleeping/retrying until the worker's external timeout is reached; only hand off as `blocker` when there is no parseable wait and three consecutive retries still produce usage-limit comments. While sleeping, append progress lines that include the detected reset time/duration so orchestration can distinguish intentional sleep from a hung worker.

## Finding Sources

Classify:

- unresolved root inline comments;
- latest unresolved CodeRabbit pushback replies;
- actionable CodeRabbit review-body bullets for current head;
- older root comments still lacking replies.

Ignore summary/walkthrough comments unless they contain explicit actionable bullets not duplicated inline.

## Feedback

After every inline reply, post a reaction on the original inline comment when possible:

- `+1` for real helpful/actionable findings;
- `-1` for false positive/stale/out-of-scope.

Use `FEEDBACK_LOG` to avoid duplicate reactions.
