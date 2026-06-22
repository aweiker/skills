# Worker Prompt Template

Write this content verbatim to `/tmp/<SESSION_ID>-prompt.md`, substituting the bracketed values.
Start with the explicit skill command so non-interactive pi expands this skill in worker mode.

---

```
/skill:ghe-pr-review-loop worker mode

You are the worker pi instance. Do not spawn another pi instance. Do the actual coding/review-fix task. Keep stdout concise and write detailed results to HANDOFF.

Task: run <LOOP_COUNT> preflight-first GitHub Enterprise PR review loop(s) for PR #<PR> and address actionable items. Do not trigger a new review unless preflight says one is required. Loop count options: 1 (single pass), 3 (standard), 5 (thorough), or "until clean" (run until approval signal or quality decline, hard cap of 8 rounds). Never exceed 8 rounds regardless of loop count or "until clean" mode.

Success condition: the loop succeeds when ONE of these is true:
- The bot produces zero new findings (clean review).
- All findings in a round are false positives or out of scope (nothing real to fix).
- An explicit approval signal appears.
Fixing real defects is good work, but the goal is a clean PR, not maximizing fixes. Stopping early because the bot has nothing real left to say IS success.

Inputs:
- WORKTREE: <absolute path>
- PR: <number>
- OWNER_REPO: <owner/repo>
- GHE_API: <full API base>
- SESSION_ID: <session id>
- LOG: <log path>
- HANDOFF: <handoff path>

Worker requirements:
0. After completing each round (including the rehydrate-only preflight round), append a one-line status to `/tmp/<SESSION_ID>-progress.log` with: round number, findings count, avg quality score, action taken (e.g. "replied", "fixed+pushed", "stopped: quality decline"). This file is the orchestrator's only real-time visibility into worker progress.
1. Work only in WORKTREE.
2. Rehydrate current state first: `git status --short --branch`, `gh pr view`, and full GHE inline comments API.
3. Before triggering a new review, check for existing unaddressed root inline comments and approval signals.
4. If existing root inline comments still have no threaded reply, do not trigger a new review; classify and address those comments first.
5. If no root inline comments are unaddressed and an **explicit** comment-based approval signal exists (e.g. "lgtm", "approved", "no actionable findings" posted after the current HEAD), do not trigger a new review; write HANDOFF and stop. IMPORTANT: "all comments already have replies" is NOT an approval signal — it means prior work is done and you should proceed to trigger a fresh review.
6. Trigger a new bot review only when there are no unaddressed root inline comments and no approval signal, by posting a `/review` comment on the PR.
7. Wait for the new review/comments to finish posting.
8. Classify root inline comments that are new since this trigger, plus any older root comments that still have no threaded reply. Do not add duplicate replies to already-addressed historical threads.
9. For every valid actionable finding: identify invariant, search adjacent/global defect class, add/update tests or documented validation, fix, run focused validation, then full repo-required validation.
10. For false positives: do not make harmful changes; prepare a rebuttal with evidence.
11. Post inline replies for false-positive and out-of-scope findings immediately after classification — before commit or push. These carry no SHA reference.
12. Push fixes. Use `--force-with-lease` only if amending an already-pushed review-fix commit; otherwise make a focused commit and push normally.
13. Post inline replies for actionable findings immediately after push using the actual commit SHA and "CI: pending". Do not wait for CI before replying.
14. Wait for CI to complete on the latest head. If CI fails, investigate and write HANDOFF with the blocker — do not post a second reply claiming a fix if CI is red.
15. Write HANDOFF with latest head SHA, fixed findings, rejected findings, validation, CI state, review-fix verification, and worktree cleanliness.
16. After triaging ALL findings in a round, run the post-triage quality gate BEFORE writing any fix code. If the gate says stop (all findings ≤0.3, or round avg ≤0.5), reply to non-actionable findings, write HANDOFF, and exit — do not fix, do not push, do not trigger another round. This gate is non-negotiable: "but I can fix this easily" is not a valid override. The cost is not the fix — it's the CI cycle, the re-trigger, and the next round of even-lower-quality findings that the fix invites. Flag any unfixed cleanup items in HANDOFF as deferred.
17. Stop after the requested loop count (default: 5). Do not enter an infinite bot-appeasement loop.
18. If you cannot complete the task, still write HANDOFF with the blocker and current worktree status before exiting.
```
