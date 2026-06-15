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
prompt content. Substitute all bracketed values including `<LOOP_COUNT>` from the user's answer
to the loop count question (1 / 3 / 5 / until clean). Write the filled-in template to
`/tmp/<SESSION_ID>-prompt.md`.

## 3. Spawn the Worker

Use `nohup` and redirect output. Prefer `PI_WORKER_PROMPT` so shell quoting is simple and the
`@file` argument is unambiguous. Use an explicit `bash -lc` wrapper only if environment setup is
needed; otherwise spawn `pi` directly so `$!` is the worker process:

```bash
cd "$WORKTREE"
PI_WORKER_PROMPT="/tmp/$SESSION_ID-prompt.md"
nohup pi --approve \
  --session-id "$SESSION_ID" \
  --skill /home/ubuntu/.pi/agent/skills/ghe-pr-review-loop \
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

## 4. Report Launch Status

Return only:

```text
Spawned worker pi.
Session: <SESSION_ID>
PID file: /tmp/<SESSION_ID>.pid
Log: <LOG>
Handoff: <HANDOFF>
Worktree: <WORKTREE>
```

## Status Checks

When the user asks for status, avoid importing large logs:

```bash
cat "/tmp/$SESSION_ID.pid" 2>/dev/null || true
pgrep -af "($SESSION_ID|/tmp/$SESSION_ID-prompt.md)" || true
tail -n 40 "$LOG" 2>/dev/null || true
test -f "$HANDOFF" && cat "$HANDOFF"
```

## Cancellation

```bash
PID=$(cat "/tmp/$SESSION_ID.pid" 2>/dev/null || true)
[ -n "$PID" ] && pkill -TERM -P "$PID" 2>/dev/null || true
[ -n "$PID" ] && kill -TERM "$PID" 2>/dev/null || true
pgrep -af "($SESSION_ID|/tmp/$SESSION_ID-prompt.md)" || true
```

Then inspect `git status --short --branch` in the worktree.
