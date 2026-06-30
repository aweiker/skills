# Worked Example

This shows truncated but real output from a successful 3-issue pipeline run. Use this for
calibrating expected behavior and debugging when output diverges from the pattern.

**Load this file** when debugging a failed pipeline run or explaining expected output format.
**Do NOT load** during normal pipeline generation.

---

## Successful run log (truncated)

```text
[2026-06-25T01:01:02Z] ==========================================
[2026-06-25T01:01:02Z] ISSUE #273 — branch: issue-273-problems-ui-badges
[2026-06-25T01:01:02Z] ==========================================
[2026-06-25T01:01:02Z] [1/5] Setting up worktree
[2026-06-25T01:01:06Z]   Worktree ready: /home/ubuntu/worktrees/service-intelligence-platform/issue-273-problems-ui-badges
[2026-06-25T01:01:06Z] [2/5] Design-first implementation
[2026-06-25T01:01:06Z]   Agent PID: 3128779 (session: impl-273-1782349266)
[2026-06-25T01:06:06Z]     (waiting for handoff... 300s elapsed)
[2026-06-25T01:11:06Z]     (waiting for handoff... 600s elapsed)
[2026-06-25T01:18:42Z]   Implementation complete
[2026-06-25T01:18:42Z]   PR #280 opened
[2026-06-25T01:18:42Z] [3/5] Targeted self-review
[2026-06-25T01:18:42Z]   Agent PID: 3145201 (session: review-273-1782350322)
[2026-06-25T01:28:15Z]   Self-review complete
[2026-06-25T01:28:30Z] [4/5] Bot review loop (5 rounds)
[2026-06-25T01:28:30Z]   Agent PID: 3152088 (session: ai-pr-review-loop-ghe-pr-bot-280-1782350910)
[2026-06-25T01:35:44Z]   Bot review complete
[2026-06-25T01:35:44Z] [5/5] Merging PR #280
[2026-06-25T01:36:01Z]   Merged via gh pr merge
[2026-06-25T01:36:05Z]   Issue #273 done ✓ (PR #280 merged)

[2026-06-25T01:36:15Z] ==========================================
[2026-06-25T01:36:15Z] ISSUE #274 — branch: issue-274-problems-detail-page
[2026-06-25T01:36:15Z] ==========================================
[2026-06-25T01:36:15Z] [1/5] Setting up worktree
[2026-06-25T01:36:19Z]   Worktree ready: /home/ubuntu/worktrees/service-intelligence-platform/issue-274-problems-detail-page
[2026-06-25T01:36:19Z] [2/5] Design-first implementation
[2026-06-25T01:36:19Z]   Agent PID: 3160445 (session: impl-274-1782351379)
[2026-06-25T02:05:33Z]   Implementation complete
[2026-06-25T02:05:33Z]   PR #281 opened
[2026-06-25T02:05:33Z] [3/5] Targeted self-review
[2026-06-25T02:05:33Z]   Agent PID: 3178902 (session: review-274-1782353133)
[2026-06-25T02:15:11Z]   Self-review complete
[2026-06-25T02:15:26Z] [4/5] Bot review loop (5 rounds)
[2026-06-25T02:15:26Z]   Agent PID: 3185776 (session: ai-pr-review-loop-ghe-pr-bot-281-1782353726)
[2026-06-25T02:28:09Z]   Bot review complete
[2026-06-25T02:28:09Z] [5/5] Merging PR #281
[2026-06-25T02:28:22Z]   Merged via gh pr merge
[2026-06-25T02:28:26Z]   Issue #274 done ✓ (PR #281 merged)

[2026-06-25T02:28:36Z] ==========================================
[2026-06-25T02:28:36Z] ISSUE #275 — branch: issue-275-problems-cross-env
[2026-06-25T02:28:36Z] ==========================================
[2026-06-25T02:28:36Z] [1/5] Setting up worktree
[2026-06-25T02:28:40Z]   Worktree ready: /home/ubuntu/worktrees/service-intelligence-platform/issue-275-problems-cross-env
[2026-06-25T02:28:40Z] [2/5] Design-first implementation
[2026-06-25T02:28:40Z]   Agent PID: 3198234 (session: impl-275-1782354520)
[2026-06-25T03:08:40Z]   ERROR: Implementation timed out after 2400s
[2026-06-25T03:08:40Z]   Skipping issue #275

[2026-06-25T03:08:40Z] ==========================================
[2026-06-25T03:08:40Z] PIPELINE COMPLETE
[2026-06-25T03:08:40Z] ==========================================
[2026-06-25T03:08:40Z] Results:
[2026-06-25T03:08:40Z]   #273 (issue-273-problems-ui-badges)
[2026-06-25T03:08:40Z]   #274 (issue-274-problems-detail-page)
[2026-06-25T03:08:40Z]   #275 (issue-275-problems-cross-env)
```

## Timing patterns

Typical phase durations (calibration data):

| Phase | Small issue (~100 lines) | Medium issue (~300 lines) | Large issue (~500+ lines) |
|-------|--------------------------|---------------------------|---------------------------|
| Worktree setup | 4-10s | 4-10s | 4-10s |
| Implementation | 10-20 min | 20-35 min | 30-40 min (may timeout) |
| Self-review | 5-12 min | 8-15 min | 12-20 min (may timeout) |
| Bot review | 3-8 min (1-2 rounds) | 5-15 min (2-3 rounds) | 8-25 min (3-5 rounds) |
| Merge + settle | 20-30s | 20-30s | 20-30s |
| **Total per issue** | **~20-40 min** | **~35-65 min** | **~50-85 min** |

## Status file at each point

After Phase 2 (implementation complete):
```json
{
  "pipeline_state": "running",
  "started_at": "2026-06-25T01:01:02Z",
  "current_issue": 273,
  "current_phase": "self-review",
  "current_phase_started_at": "2026-06-25T01:18:42Z",
  "current_agent_pid": 3145201,
  "current_pr": 280,
  "issues_completed": [],
  "issues_skipped": [],
  "issues_remaining": [274, 275],
  "last_update": "2026-06-25T01:18:42Z"
}
```

After pipeline completes:
```json
{
  "pipeline_state": "completed",
  "started_at": "2026-06-25T01:01:02Z",
  "current_issue": null,
  "current_phase": null,
  "current_phase_started_at": null,
  "current_agent_pid": null,
  "current_pr": null,
  "issues_completed": [273, 274],
  "issues_skipped": [275],
  "issues_remaining": [],
  "last_update": "2026-06-25T03:08:40Z"
}
```
