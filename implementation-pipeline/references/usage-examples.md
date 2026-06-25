# Implementation Pipeline — Usage Examples

These examples show how to invoke the skill. They are user-facing reference only — do not load
this file during pipeline generation.

---

## Basic usage

```
Implement issues #273, #274, #275, #276, #277 sequentially with full review pipeline.
```

The skill auto-detects repo, remote, API URL, worktree convention from the current directory
and AGENTS.md.

## With options

```
Run the implementation pipeline for issues #50, #51, #52.
Use 3 review rounds instead of 5.
Skip the targeted self-review — just do implementation + bot review + merge.
```

## Single issue (worker mode)

```
/skill:implementation-pipeline worker mode
Implement issue #273 through the full pipeline: design-first, review, bot loop, merge.
```

## Resume after failure

```
Issues #274 and #275 failed to merge last run. Resume the pipeline from #274.
```

(The existing-PR detection means already-merged issues are safely skipped.)

## Dry run (no merge)

```
Run the implementation pipeline for #273-#277 but don't merge — I want to review before merging.
```

(Sets `NO_MERGE=1` — the pipeline stops after bot review for each issue.)

## Custom context

```
Implement issues #100, #101, #102 sequentially.
Extra context: these are all React components using Mantine v7, follow existing patterns in
frontend/src/pages/. The backend API is already complete.
```

## Skip bot review (no review bot configured)

```
Run the implementation pipeline for #10, #11, #12 but skip the bot review loop.
```

(Sets `SKIP_BOT=1` — useful for repos on public GitHub without a GHE PR-Bot.)

## Cancellation

From another terminal:
```bash
tmux kill-session -t impl-pipeline
```

The EXIT trap will kill all child `pi` processes. Check the log for final state:
```bash
tail -20 /tmp/impl-pipeline-*/loop.log
```
