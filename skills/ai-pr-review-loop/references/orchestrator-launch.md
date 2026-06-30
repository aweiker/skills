<!-- markdownlint-disable MD013 -->

# Orchestrator Launch Procedure

## 1. Safety Rehydrate

Run concise checks only:

```bash
cd "$WORKTREE"
git status --short --branch
gh pr view "$PR" --json number,title,headRefName,headRefOid,baseRefName,statusCheckRollup
```

If the worktree is unexpectedly dirty, ask whether to continue. Do not spawn a worker into unknown local changes.

## 2. Create Worker Prompt File

**MANDATORY — READ ENTIRE FILE**: Load `references/worker-prompt-template.md`.

Substitute every bracketed value:

- `<PROVIDER>` from SKILL.md provider selection.
- `<PROVIDER_FILE>` from the provider table.
- `<LOOP_COUNT>` from the loop-count table.
- `<API_BASE>` from the selected provider file.
- `<absolute path>`, `<number>`, `<owner/repo>`, `<session id>`, `<log path>`, `<handoff path>`.

Write the filled prompt to `/tmp/<SESSION_ID>-prompt.md`.

## 3. Spawn Worker

Use direct `nohup pi`; `$!` must be the worker `pi` PID:

```bash
cd "$WORKTREE"
PI_WORKER_PROMPT="/tmp/$SESSION_ID-prompt.md"
# Resolve this from the loaded package path before executing.
AI_PR_REVIEW_SKILL="<absolute path to this package's skills/ai-pr-review-loop directory>"
nohup pi --approve \
  --session-id "$SESSION_ID" \
  --skill "$AI_PR_REVIEW_SKILL" \
  -p "@$PI_WORKER_PROMPT" \
  > "$LOG" 2>&1 &
WORKER_PID=$!
echo "$WORKER_PID" > "/tmp/$SESSION_ID.pid"
```

Verify:

```bash
pgrep -af "($SESSION_ID|/tmp/$SESSION_ID-prompt.md)"
pstree -ap "$WORKER_PID" 2>/dev/null || true
```

## 4. Spawn Status Poller

```bash
cat > "/tmp/$SESSION_ID-poller.sh" <<'POLLER'
#!/usr/bin/env bash
set -eu
SESSION_ID="$1"
WORKER_PID="$2"
PROGRESS_LOG="/tmp/${SESSION_ID}-progress.log"
HANDOFF="/tmp/${SESSION_ID}-handoff.md"
STATUS="/tmp/${SESSION_ID}-status.txt"

while true; do
  {
    echo "--- Status as of $(date -u +%Y-%m-%dT%H:%M:%SZ) ---"
    if [ -f "$HANDOFF" ]; then
      echo "STATE: COMPLETED"
      echo ""
      cat "$HANDOFF"
    elif kill -0 "$WORKER_PID" 2>/dev/null; then
      echo "STATE: RUNNING (PID $WORKER_PID)"
      echo ""
      if [ -s "$PROGRESS_LOG" ]; then
        echo "Progress:"
        cat "$PROGRESS_LOG"
      else
        echo "Progress: (no rounds completed yet)"
      fi
    else
      echo "STATE: DEAD (worker exited without handoff)"
      echo ""
      [ -s "$PROGRESS_LOG" ] && { echo "Last progress:"; cat "$PROGRESS_LOG"; }
    fi
  } > "$STATUS"

  [ -f "$HANDOFF" ] && exit 0
  kill -0 "$WORKER_PID" 2>/dev/null || exit 1
  sleep 30
done
POLLER
chmod +x "/tmp/$SESSION_ID-poller.sh"
nohup "/tmp/$SESSION_ID-poller.sh" "$SESSION_ID" "$WORKER_PID" >/dev/null 2>&1 &
POLLER_PID=$!
echo "$POLLER_PID" > "/tmp/$SESSION_ID-poller.pid"
```

## 5. Report and Poll

Report:

```text
Spawned AI PR review worker.
Provider: <PROVIDER>
Session: <SESSION_ID>
Worker PID: <WORKER_PID>
Poller PID: <POLLER_PID>
Status file: /tmp/<SESSION_ID>-status.txt
Handoff: <HANDOFF>
Worktree: <WORKTREE>
```

Then poll every 60 seconds until complete/dead or interrupted:

```bash
sleep 60
cat "/tmp/$SESSION_ID-status.txt" 2>/dev/null || echo "(not yet available)"
```

## Cancellation

```bash
PID=$(cat "/tmp/$SESSION_ID.pid" 2>/dev/null || true)
POLLER_PID=$(cat "/tmp/$SESSION_ID-poller.pid" 2>/dev/null || true)
[ -n "$PID" ] && pkill -TERM -P "$PID" 2>/dev/null || true
[ -n "$PID" ] && kill -TERM "$PID" 2>/dev/null || true
[ -n "$POLLER_PID" ] && kill -TERM "$POLLER_PID" 2>/dev/null || true
pgrep -af "($SESSION_ID|/tmp/$SESSION_ID-prompt.md)" || true
cd "$WORKTREE" && git status --short --branch
```
