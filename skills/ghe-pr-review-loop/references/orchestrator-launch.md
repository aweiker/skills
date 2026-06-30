# Orchestrator Launch Procedure

## 1. Safety Rehydrate

Run only concise commands:

```bash
cd "$WORKTREE"
git status --short --branch
gh pr view "$PR" --json number,title,headRefName,headRefOid,baseRefName,statusCheckRollup
```

If the worktree is dirty, decide with the user whether to let the worker continue. Do not silently spawn a worker into an unexpectedly dirty tree.

## 2. Create Worker Prompt File

**MANDATORY — READ ENTIRE FILE**: Load `references/worker-prompt-template.md` for the exact
prompt content. Substitute all bracketed values including `<LOOP_COUNT>` — infer the loop count
from the user's prompt per the Loop Count table in SKILL.md (default: 5). Write the filled-in
template to `/tmp/<SESSION_ID>-prompt.md`.

## 3. Spawn the Worker

Use `nohup` and redirect output. Prefer `PI_WORKER_PROMPT` so shell quoting is simple and the
`@file` argument is unambiguous. Use an explicit `bash -lc` wrapper only if environment setup is
needed; otherwise spawn `pi` directly so `$!` is the worker process:

```bash
cd "$WORKTREE"
PI_WORKER_PROMPT="/tmp/$SESSION_ID-prompt.md"
# Resolve this from the loaded package path before executing.
GHE_REVIEW_SKILL="<absolute path to this package's skills/ghe-pr-review-loop directory>"
nohup pi --approve \
  --session-id "$SESSION_ID" \
  --skill "$GHE_REVIEW_SKILL" \
  -p "@$PI_WORKER_PROMPT" \
  > "$LOG" 2>&1 &
WORKER_PID=$!
echo "$WORKER_PID" > "/tmp/$SESSION_ID.pid"
```

If you used a shell wrapper, report both the wrapper PID and child `pi` PID. With the direct
`nohup pi ... &` form above, `$!` should be the worker `pi` PID. Verify with:

```bash
pgrep -af "($SESSION_ID|/tmp/$SESSION_ID-prompt.md)"
pstree -ap "$WORKER_PID" 2>/dev/null || true
```

## 4. Spawn Status Poller

After the worker is confirmed alive, spawn a background poller that writes consolidated status
to `/tmp/<SESSION_ID>-status.txt` every 30 seconds. The poller exits when the handoff file
appears or the worker PID dies.

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
      if [ -s "$PROGRESS_LOG" ]; then
        echo "Last progress:"
        cat "$PROGRESS_LOG"
      fi
    fi
  } > "$STATUS"

  # Exit conditions
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

## 5. Report Launch Status and Poll

First, report the spawn:

```text
Spawned worker pi.
Session: <SESSION_ID>
PID file: /tmp/<SESSION_ID>.pid
Poller PID: /tmp/<SESSION_ID>-poller.pid
Status file: /tmp/<SESSION_ID>-status.txt
Handoff: <HANDOFF>
Worktree: <WORKTREE>
```

Then immediately begin polling the status file. Wait 60 seconds after launch, then read
`/tmp/<SESSION_ID>-status.txt`. If the state is `COMPLETED` or `DEAD`, report the final result.
If still `RUNNING`, report the current progress and poll again after another 60 seconds. Continue
until the worker finishes or the user interrupts. This avoids the user having to manually ask for
status updates.

```bash
sleep 60
cat "/tmp/$SESSION_ID-status.txt" 2>/dev/null || echo "(not yet available)"
```

Repeat until state is no longer `RUNNING`. When `COMPLETED`, present the handoff content as the
final result.

## Status Checks

When the user asks for status, read the consolidated status file first — it is updated every 30
seconds by the background poller and contains the current state, progress, or full handoff:

```bash
cat "/tmp/$SESSION_ID-status.txt" 2>/dev/null || echo "(status file not yet created)"
```

If the status file is stale or missing, fall back to direct checks:

```bash
cat "/tmp/$SESSION_ID.pid" 2>/dev/null || true
kill -0 "$(cat /tmp/$SESSION_ID.pid 2>/dev/null)" 2>/dev/null && echo "Worker: alive" || echo "Worker: dead"
cat "/tmp/$SESSION_ID-progress.log" 2>/dev/null || echo "(no rounds completed yet)"
test -f "$HANDOFF" && cat "$HANDOFF"
```

## Cancellation

```bash
PID=$(cat "/tmp/$SESSION_ID.pid" 2>/dev/null || true)
POLLER_PID=$(cat "/tmp/$SESSION_ID-poller.pid" 2>/dev/null || true)
[ -n "$PID" ] && pkill -TERM -P "$PID" 2>/dev/null || true
[ -n "$PID" ] && kill -TERM "$PID" 2>/dev/null || true
[ -n "$POLLER_PID" ] && kill -TERM "$POLLER_PID" 2>/dev/null || true
pgrep -af "($SESSION_ID|/tmp/$SESSION_ID-prompt.md)" || true
```

Then inspect `git status --short --branch` in the worktree.
