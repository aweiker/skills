---
name: agent
description: Spawn isolated sub-agents for delegated tasks. Use when a workflow requires isolated context, parallel investigation, chained multi-step delegation, or keeping deliberation out of the main context window. Covers design sub-agents, implementation sub-agents, review sub-agents, and scout/recon sub-agents.
allowed-tools:
  - subagent
---

# Agent — Sub-agent Dispatch

Spawn sub-agents with isolated context windows. Each sub-agent runs as a separate process with its
own context, tools, and model. Results return to the caller without polluting the main conversation.

## When to use

- A skill or workflow says "spawn a sub-agent" or "delegate to an isolated agent"
- You need to keep deliberation/exploration out of the main context
- You want parallel investigation of independent questions
- You need a chain of specialists (scout → planner → worker)

## Tool

The tool is called `subagent`. It supports three modes:

### Single mode

Delegate one task to one agent:

```json
{
  "agent": "worker",
  "task": "Implement the validation logic described in the plan above. Files: src/app/validate.py, tests/test_validate.py. Plan: ..."
}
```

### Parallel mode

Run multiple agents concurrently (max 8 tasks, 4 concurrent):

```json
{
  "tasks": [
    { "agent": "scout", "task": "Find all authentication code in src/" },
    { "agent": "scout", "task": "Find all database migration files and their schemas" }
  ]
}
```

### Chain mode

Sequential handoff — each step's output feeds into `{previous}` in the next step:

```json
{
  "chain": [
    { "agent": "scout", "task": "Find all files related to metric persistence in this repo" },
    { "agent": "planner", "task": "Given this context:\n{previous}\n\nCreate an implementation plan for adding retention policies." },
    { "agent": "worker", "task": "Implement this plan:\n{previous}" }
  ]
}
```

### Optional parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `agentScope` | `"user"` | `"user"` = `~/.pi/agent/agents/` only. `"both"` = also load `.pi/agents/` from project. `"project"` = project only. |
| `confirmProjectAgents` | `true` | Prompt before running project-local agents |
| `cwd` | caller's cwd | Working directory for the agent process (single mode) |

## Available agents

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| `scout` | Haiku | read, grep, find, ls, bash | Fast codebase recon; returns compressed context for handoff |
| `planner` | Sonnet | read, grep, find, ls | Creates implementation plans from context; does NOT modify files |
| `worker` | Sonnet | all | General-purpose; implements, tests, fixes — full capabilities |
| `reviewer` | Sonnet | read, grep, find, ls, bash | Code review for quality/security; read-only bash only |

## Prompting sub-agents effectively

1. **Include full context** — the sub-agent has an empty context window. It cannot see your
   conversation history, loaded skills, or earlier tool results unless you paste them into `task`.

2. **Be explicit about scope** — name exact file paths, functions, constraints, and expected output
   format. A vague prompt produces a shallow result.

3. **Specify output format** — tell the sub-agent what structure you need back (plan, verification
   summary, file list, etc.) so you can consume it without re-parsing.

4. **Keep tasks focused** — one sub-agent, one concern. Split broad work into parallel scouts or
   chained steps rather than overloading a single agent.

5. **Don't leak answers** — if using a sub-agent to validate or review, give it the artifact under
   test, not your conclusion about what's wrong.

## Design-first workflow integration

When `design-first-implementation` or another skill says "spawn a design sub-agent" or "spawn an
implementation sub-agent", use these patterns:

### Design sub-agent (Phase 1)

```json
{
  "agent": "planner",
  "task": "You are a design sub-agent. Produce a complete Design/test plan using this template:\n\n## Design/test plan\n### Goal\n### Non-goals\n### Invariants\n### Happy paths\n### Unhappy paths\n### State-transition table\n### Migration/backfill behavior\n### Tests to write first\n### Open questions\n\nTask description:\n<full task description here>\n\nRelevant file context:\n<file contents or summaries here>\n\nCover all applicable workflow steps. Spend deliberate time on unhappy paths."
}
```

### Implementation sub-agent (Phase 2)

```json
{
  "agent": "worker",
  "task": "You are an implementation sub-agent. Implement ONLY against the approved test matrix below. Do not re-derive intent from scratch.\n\nApproved plan:\n<paste the approved design/test plan here>\n\nRelevant files:\n<file paths and key context>\n\nWhen done, produce a Verification summary:\n## Acceptance criteria trace\n- Criterion → artifact → test\n## Edge cases covered\n## Validation\n- command outputs\n## Review loop findings"
}
```

### Review sub-agent

```json
{
  "agent": "reviewer",
  "task": "Review the changes on the current branch against main. Focus on: <specific concerns>. Check for: security boundaries, missing tests, contract violations, naming consistency."
}
```

## Cross-harness note

This skill targets pi's `subagent` extension tool. Other harnesses use different mechanisms:

- **Claude Code**: built-in `Task` tool — `Task(description="...", prompt="...")`
- **Codex**: implicit sub-agent spawning via prose instructions

If porting skills that reference this `agent` skill to another harness, replace the `subagent`
tool calls with the native equivalent.
