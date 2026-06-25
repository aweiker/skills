# Pipeline Script Template

Generate this script by substituting all `<BRACKETED>` values. Write to
`/tmp/impl-pipeline-<TIMESTAMP>/pipeline.sh`.

---

```bash
#!/usr/bin/env bash
set -uo pipefail
# NOTE: no `set -e` — errors are handled explicitly per phase.
# `set -u` catches typos, `pipefail` catches mid-pipeline failures.

# Implementation Pipeline — generated <TIMESTAMP>
# Issues: <ISSUE_LIST_DISPLAY>

REPO="<REPO>"
WORKTREE_BASE="<WORKTREE_BASE>"
OWNER_REPO="<OWNER_REPO>"
GHE_API="<GHE_API>"
MERGE_STRATEGY="<MERGE_STRATEGY>"
REVIEW_LOOP_COUNT=<REVIEW_LOOP_COUNT>
TIMEOUT_IMPL=<TIMEOUT_IMPL>
TIMEOUT_REVIEW=<TIMEOUT_REVIEW>
TIMEOUT_BOT=<TIMEOUT_BOT>
TIMEOUT_CI=600  # 10 minutes max to wait for CI
SKIP_REVIEW="${SKIP_REVIEW:-0}"
SKIP_BOT="${SKIP_BOT:-0}"
SKIP_SCOPE_GATE="${SKIP_SCOPE_GATE:-0}"
FORCE_ISSUES="${FORCE_ISSUES:-}"  # Comma-separated issue numbers to bypass scope gate
NO_MERGE="${NO_MERGE:-0}"

LOG_DIR="/tmp/impl-pipeline-<TIMESTAMP>"
mkdir -p "$LOG_DIR"

ISSUES=(<ISSUE_NUMBERS>)
BRANCHES=(<BRANCH_NAMES>)

# ── Process management ───────────────────────────────────
CHILD_PIDS=()
CURRENT_AGENT_PID=""

cleanup() {
  local exit_code=$?
  log "Pipeline interrupted (exit=$exit_code) — killing child processes"
  for pid in "${CHILD_PIDS[@]:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      # Kill entire process group to catch pi's children
      kill -TERM -- -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
      log "  Sent TERM to PID $pid"
    fi
  done
  # Give children 5s to exit, then force kill
  sleep 5
  for pid in "${CHILD_PIDS[@]:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
      log "  Force-killed PID $pid"
    fi
  done
  write_status "killed" "" "" "" "" ""
  log "Cleanup complete. Check $LOG_DIR/loop.log for final state."
  exit "$exit_code"
}
trap cleanup INT TERM
# NOTE: EXIT trap not set — we disarm on clean exit. If we set EXIT here,
# it fires on every `exit 0` including clean completion.

# ── Utility functions ────────────────────────────────────
log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_DIR/loop.log"
}

write_status() {
  local state="$1" issue="$2" phase="$3" pid="$4" pr="$5" phase_start="$6"
  # Atomic write: write to tmp then mv to prevent partial reads
  cat > "$LOG_DIR/status.json.tmp" <<STATUSEOF
{
  "pipeline_state": "$state",
  "started_at": "$PIPELINE_START",
  "current_issue": ${issue:-null},
  "current_phase": ${phase:+\"$phase\"},
  "current_phase_started_at": ${phase_start:+\"$phase_start\"},
  "current_agent_pid": ${pid:-null},
  "current_pr": ${pr:-null},
  "issues_completed": [$(IFS=,; echo "${ISSUES_COMPLETED[*]:-}")],
  "issues_skipped": [$(IFS=,; echo "${ISSUES_SKIPPED[*]:-}")],
  "issues_remaining": [$(IFS=,; echo "${ISSUES_REMAINING[*]:-}")],
  "last_update": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
STATUSEOF
  mv "$LOG_DIR/status.json.tmp" "$LOG_DIR/status.json"
}

check_control() {
  # Read and consume the control file if it exists
  if [ -f "$LOG_DIR/control" ]; then
    local cmd
    cmd=$(cat "$LOG_DIR/control" 2>/dev/null || echo "")
    : > "$LOG_DIR/control"  # Truncate after reading
    echo "$cmd"
  else
    echo ""
  fi
}

wait_for_handoff() {
  # Wait for a handoff file to appear with dead-PID detection and heartbeat.
  #
  # The handoff file is expected to be written atomically by the agent:
  # write to a .tmp file then mv. If your agent writes directly, there's a
  # small race window — we mitigate by checking file is non-empty.
  local handoff_file="$1"
  local timeout="$2"
  local agent_pid="${3:-}"
  local elapsed=0

  while [ $elapsed -lt "$timeout" ]; do
    # Check if handoff file exists AND is non-empty (guards against partial writes)
    if [ -f "$handoff_file" ] && [ -s "$handoff_file" ]; then
      return 0
    fi

    # Dead-PID detection: if the agent died without writing handoff, stop waiting
    if [ -n "$agent_pid" ] && ! kill -0 "$agent_pid" 2>/dev/null; then
      # Agent is dead. Give it 5s grace for filesystem flush.
      sleep 5
      if [ -f "$handoff_file" ] && [ -s "$handoff_file" ]; then
        return 0
      fi
      log "    Agent PID $agent_pid died without writing handoff"
      return 1
    fi

    sleep 30
    elapsed=$((elapsed + 30))

    # Heartbeat every 5 minutes
    if (( elapsed % 300 == 0 )); then
      log "    (waiting for handoff... ${elapsed}s / ${timeout}s)"
    fi
  done

  # Final check after timeout
  [ -f "$handoff_file" ] && [ -s "$handoff_file" ]
}

extract_pr_number() {
  # Extract PR number — prefer gh CLI (authoritative), fall back to handoff grep.
  local worktree="$1"
  local handoff="${2:-}"
  local pr_num=""

  # Authoritative: ask gh for the PR on the current branch
  pr_num=$(cd "$worktree" && gh pr view --json number -q .number 2>/dev/null) || true
  if [ -n "$pr_num" ] && [ "$pr_num" != "null" ]; then
    echo "$pr_num"
    return 0
  fi

  # Fallback: parse handoff for "PR #NNN" or "pull/NNN" or "number: NNN"
  if [ -n "$handoff" ] && [ -f "$handoff" ]; then
    pr_num=$(grep -oP '(?:PR\s*#|pull/|number:\s*)(\d+)' "$handoff" 2>/dev/null | grep -oP '\d+' | head -1) || true
    if [ -n "$pr_num" ]; then
      echo "$pr_num"
      return 0
    fi
  fi

  echo ""
  return 1
}

wait_for_ci() {
  # Poll CI status until all checks complete or timeout.
  local pr="$1"
  local timeout="${2:-$TIMEOUT_CI}"
  local elapsed=0

  log "    Waiting for CI (max ${timeout}s)..."
  while [ $elapsed -lt "$timeout" ]; do
    local pending
    pending=$(gh pr view "$pr" --json statusCheckRollup -q \
      '[.statusCheckRollup[] | select(.status != "COMPLETED")] | length' 2>/dev/null) || true

    if [ "$pending" = "0" ]; then
      # All completed — return count of failures
      local failures
      failures=$(gh pr view "$pr" --json statusCheckRollup -q \
        '[.statusCheckRollup[] | select(.conclusion == "FAILURE")] | length' 2>/dev/null) || true
      echo "${failures:-0}"
      return 0
    fi

    sleep 30
    elapsed=$((elapsed + 30))
    if (( elapsed % 120 == 0 )); then
      log "    CI: $pending checks still pending (${elapsed}s)"
    fi
  done

  log "    CI timed out after ${timeout}s"
  echo "timeout"
  return 1
}

cleanup_worktree() {
  local wt_path="$1"
  if [ -d "$wt_path" ]; then
    cd "$REPO" || return
    git worktree remove "$wt_path" --force 2>/dev/null || rm -rf "$wt_path"
    git worktree prune 2>/dev/null || true
  fi
}

# ── Pipeline state ───────────────────────────────────────
PIPELINE_START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ISSUES_COMPLETED=()
ISSUES_SKIPPED=()
ISSUES_REMAINING=("${ISSUES[@]}")

write_status "running" "" "" "" "" ""
log "Pipeline started: ${#ISSUES[@]} issues to process"
log "Config: merge=$MERGE_STRATEGY, review_loops=$REVIEW_LOOP_COUNT, timeouts=impl:${TIMEOUT_IMPL}s/rev:${TIMEOUT_REVIEW}s/bot:${TIMEOUT_BOT}s/ci:${TIMEOUT_CI}s"

# ── Main loop ────────────────────────────────────────────
for i in "${!ISSUES[@]}"; do
  ISSUE="${ISSUES[$i]}"
  BRANCH="${BRANCHES[$i]}"
  WORKTREE="$WORKTREE_BASE/$BRANCH"
  PR_NUM=""  # Reset for this iteration
  SCOPE_WARNING=""

  # Remove from remaining
  ISSUES_REMAINING=("${ISSUES_REMAINING[@]:1}")

  # Check control file before starting each issue
  CTRL=$(check_control)
  case "$CTRL" in
    abort)
      log "ABORT command received. Stopping pipeline."
      write_status "aborted" "$ISSUE" "" "" "" ""
      break
      ;;
    pause)
      log "PAUSE command received. Waiting for 'resume'..."
      while true; do
        sleep 10
        CTRL=$(check_control)
        [ "$CTRL" = "resume" ] && break
        [ "$CTRL" = "abort" ] && { log "ABORT during pause."; write_status "aborted" "$ISSUE" "" "" "" ""; exit 0; }
      done
      log "Resumed."
      ;;
    skip)
      log "SKIP command received. Skipping issue #$ISSUE."
      ISSUES_SKIPPED+=("$ISSUE")
      continue
      ;;
  esac

  log "=========================================="
  log "ISSUE #$ISSUE — branch: $BRANCH"
  log "=========================================="

  # ── Phase 1: Worktree ─────────────────────────────────
  PHASE_START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  write_status "running" "$ISSUE" "worktree-setup" "" "" "$PHASE_START"
  log "[1/5] Setting up worktree"
  cd "$REPO"
  git fetch origin main --quiet

  if [ -d "$WORKTREE" ]; then
    # Check if a PR already exists for this branch (prior partial run)
    EXISTING_PR=$(cd "$WORKTREE" && gh pr view --json number -q .number 2>/dev/null) || true
    if [ -n "$EXISTING_PR" ] && [ "$EXISTING_PR" != "null" ]; then
      log "  WARNING: PR #$EXISTING_PR already exists for branch $BRANCH. Skipping."
      ISSUES_SKIPPED+=("$ISSUE")
      continue
    fi
    cd "$WORKTREE"
    git fetch origin main --quiet
    git reset --hard origin/main
  elif [ -x "$REPO/scripts/setup-worktree.sh" ]; then
    "$REPO/scripts/setup-worktree.sh" "$BRANCH" || {
      log "  setup-worktree.sh failed, creating manually"
      git branch -D "$BRANCH" 2>/dev/null || true
      git worktree add "$WORKTREE" -b "$BRANCH" origin/main
      cd "$WORKTREE" && [ -f Makefile ] && make sync
    }
  else
    git branch -D "$BRANCH" 2>/dev/null || true
    git worktree add "$WORKTREE" -b "$BRANCH" origin/main
    cd "$WORKTREE" && [ -f Makefile ] && make sync
  fi

  cd "$WORKTREE"
  log "  Worktree ready: $WORKTREE"

  # ── Phase 0: Scope Gate ────────────────────────────────
  if [ "$SKIP_SCOPE_GATE" = "1" ]; then
    log "[0/5] Scope gate SKIPPED (SKIP_SCOPE_GATE=1)"
  elif echo ",$FORCE_ISSUES," | grep -q ",$ISSUE,"; then
    log "[0/5] Scope gate BYPASSED (FORCE_ISSUES)"
  else
    PHASE_START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    write_status "running" "$ISSUE" "scope-gate" "" "" "$PHASE_START"
    log "[0/5] Scope gate"
    GATE_ID="gate-${ISSUE}-$(date +%s)"
    GATE_FILE="/tmp/${GATE_ID}-verdict.txt"

    cat > "$LOG_DIR/${GATE_ID}-prompt.md" <<GATE_PROMPT
You are evaluating whether GitHub issue #$ISSUE is appropriately scoped for a single
implementation + review pipeline pass.

Read the issue: \`gh issue view $ISSUE --json body,title\`

Score the issue using the Reviewability Risk Score (0-14 scale):

Boundary clarity (0-4):
- Subsystems touched: 1=0, 2=1, 3-4=2, 5+=3
- Existing code modified vs new: pure additive=0, mostly new=0, mixed=1, mostly modifying=2
- Contract boundaries: one clear=0, two=1, implicit=2, multiple/negotiable=3

Scope firmness (0-4):
- Acceptance criteria: 1-3 binary=0, 4-6 testable=1, 7-8 ambiguous=2, 9+ or qualitative=3
- Stopping point: explicit=0, implied=1, fuzzy=2, open-ended=3
- Adjacent temptation: none=0, minor=1, pattern elsewhere=2, same-file debt=2

Review difficulty (0-4):
- Estimated diff lines: <100=0, 100-250=1, 250-400=2, 400+=3
- Behavioral changes: none=0, one=1, multiple=2, state machine=3
- Domain knowledge: generic=0, one concept=1, multiple=2, compliance/security=3

Dependency risk (0-2):
- Prerequisites: all in main=0, recent=1, not merged=2
- Test isolation: self-contained=0, needs infra=1, needs live/shared=2

Thresholds:
- 0-4: proceed
- 5-7: proceed-with-warning
- 8-10: skip (recommend split)
- 11+: skip (definitely too broad)
- dependency=2: blocker (regardless of total)

Write EXACTLY ONE LINE to $GATE_FILE:
- "proceed" if score 0-4
- "proceed-with-warning:<score>; <highest-scoring factors>" if score 5-7
- "skip:<score>; <reason + split recommendation>" if score 8+
- "blocker:<what prerequisite is missing>" if dependency=2

Do not write anything else. Do not ask questions. Do not spawn another pi instance.
GATE_PROMPT

    cd "$WORKTREE"
    nohup pi --approve \
      --session-id "$GATE_ID" \
      -p "@$LOG_DIR/${GATE_ID}-prompt.md" \
      > "$LOG_DIR/${GATE_ID}.log" 2>&1 &
    GATE_PID=$!
    CHILD_PIDS+=("$GATE_PID")

    # Short timeout — this is just reading an issue and writing one line
    if ! wait_for_handoff "$GATE_FILE" 120 "$GATE_PID"; then
      log "  Scope gate timed out (120s). Proceeding by default."
      kill "$GATE_PID" 2>/dev/null || true
    else
      GATE_VERDICT=$(head -1 "$GATE_FILE" 2>/dev/null | tr -d '\n')
      case "$GATE_VERDICT" in
        proceed)
          log "  Scope gate: PROCEED"
          ;;
        proceed-with-warning:*)
          SCOPE_WARNING="${GATE_VERDICT#proceed-with-warning:}"
          log "  Scope gate: PROCEED WITH WARNING — $SCOPE_WARNING"
          ;;
        skip:*)
          log "  Scope gate: SKIP — ${GATE_VERDICT#skip:}"
          ISSUES_SKIPPED+=("$ISSUE")
          continue
          ;;
        blocker:*)
          log "  Scope gate: BLOCKER — ${GATE_VERDICT#blocker:}"
          ISSUES_SKIPPED+=("$ISSUE")
          continue
          ;;
        *)
          log "  Scope gate: unexpected verdict '$GATE_VERDICT'. Proceeding."
          ;;
      esac
    fi
  fi

  # ── Phase 2: Implementation ───────────────────────────
  PHASE_START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "[2/5] Design-first implementation"
  IMPL_ID="impl-${ISSUE}-$(date +%s)"
  IMPL_HANDOFF="/tmp/${IMPL_ID}-handoff.md"

  cat > "$LOG_DIR/${IMPL_ID}-prompt.md" <<IMPL_PROMPT
You are implementing GitHub issue #$ISSUE.

Working directory: $WORKTREE
Branch: $BRANCH
${SCOPE_WARNING:+
SCOPE WARNING: $SCOPE_WARNING
Stay focused on ONLY what the issue acceptance criteria require. Do not fix adjacent code,
refactor existing patterns, or expand scope beyond the explicit criteria. If you notice
something that needs fixing but isn't in the acceptance criteria, note it in the PR body
as a follow-up — do not implement it.
}
Instructions:
1. Read the issue: \`gh issue view $ISSUE --json body,title\`
2. Apply the design-first-implementation skill (full workflow if edge cases exist)
3. Implement following all repository AGENTS.md rules
4. Run \`make check\` (or the repo's equivalent validation) and ensure it passes
5. Commit all changes with a descriptive message referencing #$ISSUE
6. Push the branch to origin
7. Open a PR targeting main with title and body referencing #$ISSUE
8. Write a handoff to $IMPL_HANDOFF with: PR number, head SHA, validation results, files changed

Do NOT ask for clarification — implement based on the issue acceptance criteria.
Do NOT spawn another pi instance.
If the issue references prerequisites, confirm they are in main before starting.
IMPL_PROMPT

  cd "$WORKTREE"
  nohup pi --approve \
    --session-id "$IMPL_ID" \
    --skill /home/ubuntu/.pi/agent/skills/design-first-implementation \
    -p "@$LOG_DIR/${IMPL_ID}-prompt.md" \
    > "$LOG_DIR/${IMPL_ID}.log" 2>&1 &
  IMPL_PID=$!
  CHILD_PIDS+=("$IMPL_PID")
  CURRENT_AGENT_PID="$IMPL_PID"
  write_status "running" "$ISSUE" "implementation" "$IMPL_PID" "" "$PHASE_START"
  log "  Agent PID: $IMPL_PID (session: $IMPL_ID)"

  if ! wait_for_handoff "$IMPL_HANDOFF" "$TIMEOUT_IMPL" "$IMPL_PID"; then
    log "  ERROR: Implementation timed out or agent died after ${TIMEOUT_IMPL}s"
    kill -TERM "$IMPL_PID" 2>/dev/null || true
    sleep 3
    kill -9 "$IMPL_PID" 2>/dev/null || true
    log "  Skipping issue #$ISSUE"
    ISSUES_SKIPPED+=("$ISSUE")
    continue
  fi
  log "  Implementation complete"

  PR_NUM=$(extract_pr_number "$WORKTREE" "$IMPL_HANDOFF")
  if [ -z "$PR_NUM" ]; then
    log "  ERROR: Could not determine PR number. Skipping."
    ISSUES_SKIPPED+=("$ISSUE")
    continue
  fi
  log "  PR #$PR_NUM opened"
  write_status "running" "$ISSUE" "implementation-done" "$IMPL_PID" "$PR_NUM" "$PHASE_START"

  # Check control between phases
  CTRL=$(check_control)
  if [ "$CTRL" = "skip" ]; then
    log "  SKIP received after implementation. PR #$PR_NUM open but not merged."
    ISSUES_SKIPPED+=("$ISSUE")
    continue
  fi

  # ── Phase 3: Targeted self-review ─────────────────────
  if [ "$SKIP_REVIEW" = "1" ] || [ "$CTRL" = "skip-review" ]; then
    log "[3/5] Self-review SKIPPED"
  else
    PHASE_START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    write_status "running" "$ISSUE" "self-review" "" "$PR_NUM" "$PHASE_START"
    log "[3/5] Targeted self-review"
    REV_ID="review-${ISSUE}-$(date +%s)"
    REV_HANDOFF="/tmp/${REV_ID}-handoff.md"

    cat > "$LOG_DIR/${REV_ID}-prompt.md" <<REV_PROMPT
Run a targeted PR review of PR #$PR_NUM.

Working directory: $WORKTREE
Branch: $BRANCH

Instructions:
1. Use the targeted-pr-review skill for multi-dimension review
2. Fix actionable defects (real bugs, missing tests, contract violations)
3. Run \`make check\` after fixes
4. Commit and push fixes
5. Write handoff to $REV_HANDOFF with: findings, fixes, head SHA, validation result

Do NOT spawn another pi instance.
REV_PROMPT

    cd "$WORKTREE"
    nohup pi --approve \
      --session-id "$REV_ID" \
      --skill /home/ubuntu/.pi/agent/skills/targeted-pr-review \
      -p "@$LOG_DIR/${REV_ID}-prompt.md" \
      > "$LOG_DIR/${REV_ID}.log" 2>&1 &
    REV_PID=$!
    CHILD_PIDS+=("$REV_PID")
    CURRENT_AGENT_PID="$REV_PID"
    write_status "running" "$ISSUE" "self-review" "$REV_PID" "$PR_NUM" "$PHASE_START"
    log "  Agent PID: $REV_PID (session: $REV_ID)"

    if ! wait_for_handoff "$REV_HANDOFF" "$TIMEOUT_REVIEW" "$REV_PID"; then
      log "  WARNING: Self-review timed out or agent died. Continuing."
      kill -TERM "$REV_PID" 2>/dev/null || true
      sleep 3
      kill -9 "$REV_PID" 2>/dev/null || true
    else
      log "  Self-review complete"
    fi
  fi

  # Check control between phases
  CTRL=$(check_control)
  if [ "$CTRL" = "skip" ]; then
    log "  SKIP received after review. PR #$PR_NUM open but not merged."
    ISSUES_SKIPPED+=("$ISSUE")
    continue
  fi

  # ── Phase 4: Bot review loop ──────────────────────────
  if [ "$SKIP_BOT" = "1" ] || [ "$CTRL" = "skip-bot" ]; then
    log "[4/5] Bot review SKIPPED"
  else
    PHASE_START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    write_status "running" "$ISSUE" "bot-review" "" "$PR_NUM" "$PHASE_START"
    log "[4/5] Bot review loop ($REVIEW_LOOP_COUNT rounds max)"
    BOT_ID="ghe-pr-review-loop-${PR_NUM}-$(date +%s)"
    BOT_HANDOFF="/tmp/${BOT_ID}-handoff.md"

    # Minimal activation prompt — the ghe-pr-review-loop skill owns its own
    # worker contract. We pass only the variable inputs it needs.
    cat > "/tmp/${BOT_ID}-prompt.md" <<BOT_PROMPT
/skill:ghe-pr-review-loop worker mode

You are the worker pi instance. Do not spawn another pi instance.

Task: run $REVIEW_LOOP_COUNT preflight-first GitHub Enterprise PR review loop(s) for PR #$PR_NUM and address actionable items.

Inputs:
- WORKTREE: $WORKTREE
- PR: $PR_NUM
- OWNER_REPO: $OWNER_REPO
- GHE_API: $GHE_API
- SESSION_ID: $BOT_ID
- LOG: /tmp/${BOT_ID}.log
- HANDOFF: $BOT_HANDOFF
BOT_PROMPT

    cd "$WORKTREE"
    nohup pi --approve \
      --session-id "$BOT_ID" \
      --skill /home/ubuntu/.pi/agent/skills/ghe-pr-review-loop \
      -p "@/tmp/${BOT_ID}-prompt.md" \
      > "/tmp/${BOT_ID}.log" 2>&1 &
    BOT_PID=$!
    CHILD_PIDS+=("$BOT_PID")
    CURRENT_AGENT_PID="$BOT_PID"
    write_status "running" "$ISSUE" "bot-review" "$BOT_PID" "$PR_NUM" "$PHASE_START"
    log "  Agent PID: $BOT_PID (session: $BOT_ID)"

    if ! wait_for_handoff "$BOT_HANDOFF" "$TIMEOUT_BOT" "$BOT_PID"; then
      log "  WARNING: Bot review timed out or agent died. Attempting merge."
      kill -TERM "$BOT_PID" 2>/dev/null || true
      sleep 3
      kill -9 "$BOT_PID" 2>/dev/null || true
    else
      log "  Bot review complete"
      # If handoff reports CI failure, don't merge
      if grep -qi "CI.*fail\|CI.*red\|blocker" "$BOT_HANDOFF" 2>/dev/null; then
        log "  WARNING: Bot handoff indicates CI failure or blocker. Skipping merge."
        ISSUES_SKIPPED+=("$ISSUE")
        continue
      fi
    fi
  fi

  # ── Phase 5: Merge ────────────────────────────────────
  if [ "$NO_MERGE" = "1" ]; then
    log "[5/5] Merge SKIPPED (NO_MERGE=1). PR #$PR_NUM ready for manual merge."
    ISSUES_COMPLETED+=("$ISSUE")
    continue
  fi

  PHASE_START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  write_status "running" "$ISSUE" "merging" "" "$PR_NUM" "$PHASE_START"
  log "[5/5] Merging PR #$PR_NUM"
  cd "$REPO"

  # Poll CI until complete (not just a fixed sleep)
  CI_FAILURES=$(wait_for_ci "$PR_NUM" "$TIMEOUT_CI")

  if [ "$CI_FAILURES" = "0" ]; then
    # Remove worktree BEFORE merge so --delete-branch doesn't fail on local ref
    cleanup_worktree "$WORKTREE"

    if gh pr merge "$PR_NUM" --"$MERGE_STRATEGY" --delete-branch --admin 2>/dev/null; then
      log "  Merged via gh CLI"
    elif gh api "repos/$OWNER_REPO/pulls/$PR_NUM/merge" -X PUT \
        -f merge_method="$MERGE_STRATEGY" \
        -f commit_title="$(gh pr view "$PR_NUM" --json title -q .title) (#$PR_NUM)" 2>/dev/null; then
      log "  Merged via API"
      # Clean up remote branch
      gh api "repos/$OWNER_REPO/git/refs/heads/$BRANCH" -X DELETE 2>/dev/null || true
    else
      log "  ERROR: Merge failed for PR #$PR_NUM. Skipping."
      ISSUES_SKIPPED+=("$ISSUE")
      continue
    fi
  elif [ "$CI_FAILURES" = "timeout" ]; then
    log "  ERROR: CI timed out after ${TIMEOUT_CI}s. Skipping merge."
    ISSUES_SKIPPED+=("$ISSUE")
    cleanup_worktree "$WORKTREE"
    continue
  else
    log "  ERROR: CI has $CI_FAILURES failing checks. Skipping merge."
    ISSUES_SKIPPED+=("$ISSUE")
    cleanup_worktree "$WORKTREE"
    continue
  fi

  # Pull main for next issue
  cd "$REPO"
  git fetch origin main --quiet
  git pull origin main --ff-only 2>/dev/null || true
  ISSUES_COMPLETED+=("$ISSUE")
  log "  Issue #$ISSUE done ✓ (PR #$PR_NUM merged)"
  log ""

  # Brief pause between issues
  sleep 10
done

# ── Clean exit ───────────────────────────────────────────
# Disarm trap for clean exit
trap - INT TERM

write_status "completed" "" "" "" "" ""

log "=========================================="
log "PIPELINE COMPLETE"
log "=========================================="
log "Results:"
for issue in "${ISSUES_COMPLETED[@]:-}"; do
  [ -n "$issue" ] && log "  ✓ #$issue — merged"
done
for issue in "${ISSUES_SKIPPED[@]:-}"; do
  [ -n "$issue" ] && log "  ✗ #$issue — skipped"
done
log ""
log "${#ISSUES_COMPLETED[@]} merged, ${#ISSUES_SKIPPED[@]} skipped."
```
