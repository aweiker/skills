#!/usr/bin/env bash
# shellcheck disable=SC2034,SC2317
# SC2034: this test sets globals consumed indirectly by sourced pipeline.sh functions.
# SC2317: this test deliberately stubs commands such as gh/sleep for indirect calls.
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Regression tests for implementation-pipeline tracker checkpoint contracts.
#
# These tests cover two contracts that tracker checkpoints depend on:
#   1. value-returning helpers must write only their return value to stdout;
#   2. issues completed in the current pipeline session are authoritative CLOSED
#      dependencies for downstream tracker checkpoints.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PIPELINE_SH="$REPO_ROOT/skills/implementation-pipeline/pipeline.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0

ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1${2:+ — $2}"; FAIL=$((FAIL + 1)); }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    ok "$label"
  else
    fail "$label" "expected=$(printf '%q' "$expected") got=$(printf '%q' "$actual")"
  fi
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    ok "$label"
  else
    fail "$label" "expected to contain $(printf '%q' "$needle"), got $(printf '%q' "$haystack")"
  fi
}

assert_not_contains() {
  local label="$1" haystack="$2" needle="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    ok "$label"
  else
    fail "$label" "expected not to contain $(printf '%q' "$needle"), got $(printf '%q' "$haystack")"
  fi
}

make_repo() {
  local repo="$TMP_DIR/repo-$RANDOM"
  mkdir -p "$repo"
  git -C "$repo" init -q
  echo "$repo"
}

reset_pipeline_globals() {
  LOG_DIR="$TMP_DIR/log-$RANDOM"
  mkdir -p "$LOG_DIR"
  REPO="$(make_repo)"
  WORKTREE_BASE="$TMP_DIR/worktrees"
  OWNER_REPO="owner/repo"
  AI_REVIEW_PROVIDER="ghe-pr-bot"
  AI_REVIEW_API_BASE="https://github.example/api/v3"
  BASE_BRANCH="main"
  ISSUES=(117 87)
  BRANCHES=("issue-117" "tracker:116,117")
  ISSUES_COMPLETED=()
  ISSUES_COMPLETED_DETAILS=()
  ISSUES_SKIPPED=()
  CURRENT_ISSUE=87
  CURRENT_ISSUE_INDEX=1
  NEXT_ISSUE_INDEX=2
  NEXT_ISSUE=""
  CURRENT_PR=""
  CURRENT_PHASE=""
  CURRENT_PHASE_STARTED_AT=""
  CURRENT_ISSUE_STARTED_AT="2026-07-03T00:00:00Z"
  CURRENT_ISSUE_STARTED_EPOCH=""
  PIPELINE_TERMINAL_STATE="running"
}

# Source the real script in library mode.
export PIPELINE_LIB_MODE=1
# shellcheck source=/dev/null
source "$PIPELINE_SH"

echo ""
echo "=== generate_gate_prompt runtime expansion ==="

reset_pipeline_globals
ISSUES_COMPLETED=()
if prompt=$(generate_gate_prompt 123 "$TMP_DIR/gate-empty.txt"); then
  ok "generate_gate_prompt works with empty ISSUES_COMPLETED"
  assert_not_contains "empty completion list is omitted" "$prompt" "Issues completed in this pipeline session"
else
  fail "generate_gate_prompt works with empty ISSUES_COMPLETED"
fi

reset_pipeline_globals
ISSUES_COMPLETED=(117)
if prompt=$(generate_gate_prompt 123 "$TMP_DIR/gate-completed.txt"); then
  ok "generate_gate_prompt works with populated ISSUES_COMPLETED"
  assert_contains "completed issue list is included" "$prompt" "Issues completed in this pipeline session"
  assert_contains "completed issue number is included" "$prompt" "117"
else
  fail "generate_gate_prompt works with populated ISSUES_COMPLETED"
fi

echo ""
echo "=== gh_issue_state_with_retry stdout contract ==="

reset_pipeline_globals
ISSUES_COMPLETED=(117)
stderr_file="$TMP_DIR/session-completed.stderr"
if state=$(gh_issue_state_with_retry "$REPO" 117 1 1 2>"$stderr_file"); then
  assert_eq "session-completed fast path writes only CLOSED to stdout" "CLOSED" "$state"
  assert_contains "session-completed diagnostic goes to stderr" "$(cat "$stderr_file")" "completed in this session"
else
  fail "session-completed fast path returns successfully"
fi

reset_pipeline_globals
gh_calls_file="$TMP_DIR/gh-calls.txt"
: > "$gh_calls_file"
gh() {
  echo call >> "$gh_calls_file"
  if [ "$(wc -l < "$gh_calls_file")" -eq 1 ]; then
    echo "OPEN"
  else
    echo "CLOSED"
  fi
}
sleep() { :; }
stderr_file="$TMP_DIR/retry.stderr"
if state=$(gh_issue_state_with_retry "$REPO" 118 2 1 2>"$stderr_file"); then
  assert_eq "retry path writes only terminal state to stdout" "CLOSED" "$state"
  assert_contains "retry diagnostic goes to stderr" "$(cat "$stderr_file")" "retrying"
else
  fail "retry path returns successfully"
fi
unset -f gh sleep

echo ""
echo "=== tracker checkpoint session-completed dependency ==="

reset_pipeline_globals
ISSUES_COMPLETED=(117)
FAILURE_REASON=""
status_file="$TMP_DIR/write-status.txt"
gh_calls_file="$TMP_DIR/tracker-gh-calls.txt"
: > "$gh_calls_file"

write_status() { echo "$1" > "$status_file"; }
handle_issue_failure() {
  local _issue="$1" reason="$2"
  FAILURE_REASON="$reason"
  return 1
}
gh() {
  local args="$*"
  echo "$args" >> "$gh_calls_file"
  case "$args" in
    "issue view 116 --json state --jq .state") echo "CLOSED" ;;
    "issue view 87 --json state --jq .state") echo "OPEN" ;;
    "issue view 87 --json title --jq .title") echo "Registration tracker" ;;
    "issue comment 87 --body-file "*) return 0 ;;
    "issue close 87 --comment "*) return 0 ;;
    *"117"*) echo "unexpected gh call for session-completed issue: $args" >&2; return 2 ;;
    *) echo "unexpected gh call: $args" >&2; return 2 ;;
  esac
}
sleep() { :; }

if process_tracker_checkpoint 87 "tracker:116,117"; then
  ok "tracker checkpoint accepts session-completed child as CLOSED"
else
  fail "tracker checkpoint accepts session-completed child as CLOSED" "$FAILURE_REASON"
fi
assert_not_contains "tracker does not query GitHub for session-completed child" "$(cat "$gh_calls_file")" "117"
assert_contains "tracker issue is marked complete" " ${ISSUES_COMPLETED[*]} " " 87 "
assert_eq "successful tracker checkpoint writes running status" "running" "$(cat "$status_file")"
unset -f gh sleep write_status handle_issue_failure

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "$FAIL failure(s), $PASS pass(es)."
  exit 1
fi

echo ""
echo "All $PASS tracker checkpoint contract checks passed."
