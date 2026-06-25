# Common Failure Patterns

## Pattern 1: The Tutorial

```text
Symptom: Explains what PDF is, how Python works, basic library usage
Root cause: Author assumes Skill should "teach" the model
Fix: The model already knows this. Delete all basic explanations.
     Focus on expert decisions, trade-offs, and anti-patterns.
```

## Pattern 2: The Dump

```text
Symptom: SKILL.md is 800+ lines with everything included
Root cause: No progressive disclosure design
Fix: Core routing and decision trees in SKILL.md (<300 lines ideal)
     Detailed content in references/, loaded on-demand via read tool
```

## Pattern 3: The Orphan References

```text
Symptom: References directory exists but files are never loaded
Root cause: No explicit loading triggers in the SKILL.md body
Fix: Add "MANDATORY — READ ENTIRE FILE" at workflow decision points
     Add "Do NOT Load" to prevent over-loading
     In pi, references are loaded via the `read` tool — the trigger text must
     make clear WHEN to read and WHAT file path to use.
```

## Pattern 4: The Checkbox Procedure

```text
Symptom: Step 1, Step 2, Step 3... mechanical procedures
Root cause: Author thinks in procedures, not thinking frameworks
Fix: Transform into "Before doing X, ask yourself..."
     Focus on decision principles, not operation sequences
```

## Pattern 5: The Vague Warning

```text
Symptom: "Be careful", "avoid errors", "consider edge cases"
Root cause: Author knows things can go wrong but hasn't articulated specifics
Fix: Specific NEVER list with concrete examples and non-obvious reasons
     "NEVER use X because [specific problem that takes experience to learn]"
```

## Pattern 6: The Invisible Skill

```text
Symptom: Great content but skill rarely gets activated
Root cause: Description is vague, missing keywords, or lacks trigger scenarios
Fix: Description must answer WHAT, WHEN, and include KEYWORDS
     "Use when..." + specific scenarios + searchable terms

In pi, the description appears in the <available_skills> system prompt block.
The agent reads ALL descriptions when deciding what to load. If your description
doesn't match the user's request, the skill is invisible.

Example fix:
BAD:  "Helps with document tasks"
GOOD: "Create, edit, and analyze .docx files. Use when working with
       Word documents, tracked changes, or professional document formatting.
       Triggers on: .docx, tracked changes, redline, document review."
```

## Pattern 7: The Wrong Location

```text
Symptom: "When to use this Skill" section in body, not in description
Root cause: Misunderstanding of activation flow
Fix: Move all triggering information to description field
     Body is only loaded AFTER the activation decision is made

In pi: the <available_skills> block shows name + description only.
The SKILL.md body is invisible until the agent decides to activate.
```

## Pattern 8: The Over-Engineered

```text
Symptom: README.md, CHANGELOG.md, INSTALLATION_GUIDE.md, CONTRIBUTING.md
Root cause: Treating Skill like a software project
Fix: Delete all auxiliary files. Only include what the agent needs for the task.
     No documentation about the Skill itself — only documentation FOR execution.
```

## Pattern 9: The Freedom Mismatch

```text
Symptom: Rigid scripts for creative tasks, vague guidance for fragile operations
Root cause: Not considering task fragility
Fix: High freedom for creative (principles, not steps)
     Low freedom for fragile (exact scripts, no parameters)
```

## Pattern 10: The Unstable Path

```text
Symptom: Skill derives file paths for persistent state using `pwd`
Check: If two sessions invoked this skill from different directories in
       the same repo, would they share the same state file?
Root cause: Project-scoped state is keyed to the working directory, not the repo
Fix: Use `git rev-parse --show-toplevel` instead of `pwd` for repo-stable paths
```

## Pattern 11: The Repeat Questioner

```text
Symptom: Skill asks the same preference every invocation (e.g. "Quick or Full?")
Check: If the user answered this question once, would they answer the same
       way next time? If yes, the skill should persist it — not re-ask.
Root cause: No distinction between session-scoped and durable preferences
Fix: Classify each question's answer by scope before asking:
     - Session: changes per invocation → ask every time
     - Project: same within a repo, differs across repos → project config
     - User: same everywhere → user-level config
Signal: If the "right" setting would be the same for every user, the skill's
        defaults are wrong — update the skill, don't add a settings file.
```

## Pattern 12: The Copy-Paste Integration

```text
Symptom: Skill contains step-by-step API commands, authentication flows, or
         host-detection logic for an external system that another skill already owns
Check: Does another skill in the same installation already own these mechanics?
       (e.g. a ghe-pr-review-loop skill owns bot review, a graphify skill owns
       knowledge graph queries)
Root cause: Author embedded the full "how" instead of declaring the "what"
Fix: Trim to intent — state what data is needed and let the owning skill
     handle the mechanics. Pass `--skill <owning-skill>` to a spawned pi
     instance rather than pasting the other skill's prompt contract.
Signal: If a skill's instructions would break when the owning skill updates
        its API calls, prompt format, or detection logic, the coupling
        is a drift risk — the copy will silently go stale.
```

## Pattern 13: The Orphan Process (pi-specific)

```text
Symptom: Skill spawns background processes (nohup, &, tmux) without cleanup
Check: If the pi session is killed mid-execution, do child processes keep
       running indefinitely? Is there a trap handler?
Root cause: Author focused on the happy path and forgot process lifecycle
Fix: Add `trap cleanup EXIT INT TERM` that kills child PIDs.
     Use wait_for_handoff with dead-PID detection (kill -0 check).
     Write status files so the invoking session can monitor.
Signal: Any `nohup ... &` without a corresponding entry in a CHILD_PIDS array
        and a trap handler is a production hazard.
```

## Pattern 14: The Infinite Delegation (pi-specific)

```text
Symptom: Skill spawns sub-agents that spawn sub-agents, creating unbounded depth
Check: Can execution depth exceed 2 levels? Is there a hard cap?
Root cause: Author didn't consider that delegation has cost (context, tokens, time)
Fix: Skills should delegate at most 1 level deep in normal operation.
     If deeper nesting is needed, use a flat orchestration loop (spawn N workers
     sequentially) rather than recursive delegation.
     Always include "Do not spawn another pi instance" in worker prompts.
Signal: If a skill's prompt to a sub-agent includes instructions that would
        themselves trigger skill loading and further delegation, the chain
        is unbounded.
```

## Pattern 15: The Context Hog (pi-specific)

```text
Symptom: Skill eagerly loads all references at the start regardless of path taken
Check: Are there references that are only needed for specific scenarios?
Root cause: Author used "read everything first" instead of conditional loading
Fix: Use "MANDATORY" triggers only at the decision point where content is needed.
     Use "Do NOT Load" to prevent loading references for irrelevant paths.
     For large reference files (>200 lines), consider whether the skill can
     give the agent just the relevant subset.
Signal: If a skill has 4+ reference files and loads them all unconditionally,
        it's consuming context that later tool calls and user messages need.
```
