# Dimension Deep-Dive Reference

## D1: Knowledge Delta

**Red flags** (instant score ≤5):

- "What is [basic concept]" sections
- Step-by-step tutorials for standard operations
- Explaining how to use common libraries
- Generic best practices ("write clean code", "handle errors")
- Definitions of industry-standard terms

**Green flags** (high knowledge delta):

- Decision trees for non-obvious choices ("when X fails, try Y because Z")
- Trade-offs only an expert would know ("A is faster but B handles edge case C")
- Edge cases from real-world experience
- "NEVER do X because [non-obvious reason]"
- Domain-specific thinking frameworks

**Cross-skill duplication**: If a skill contains step-by-step mechanics for an external system (API
commands, auth flows, host detection), check whether another skill in the installation already owns
that domain. Duplicated mechanics are not expert knowledge — they are a copy of another skill's
knowledge, and they drift when the owning skill updates. Score as [R] Redundant.

**Evaluation questions**:

1. For each section, ask: "Does the model already know this?"
2. "Is this explaining TO the model or FOR the model?"
3. "Does another skill already own these mechanics?"
4. Count paragraphs: Expert vs Activation vs Redundant

---

## D2: Mindset + Appropriate Procedures

**Key distinction**:

| Type                       | Example                                               | Value                           |
| -------------------------- | ----------------------------------------------------- | ------------------------------- |
| Thinking patterns          | "Before designing, ask: What makes this memorable?"   | High — shapes decision-making   |
| Domain-specific procedures | "OOXML workflow: unpack → edit XML → validate → pack" | High — model may not know this  |
| Generic procedures         | "Step 1: Open file, Step 2: Edit, Step 3: Save"       | Low — model already knows       |

**Valuable procedures** — non-obvious ordering, critical steps, proprietary workflows.

**Redundant procedures** — generic file ops, standard programming patterns, well-documented
libraries, or mechanics that another skill already owns (see Pattern 12: The Copy-Paste
Integration).

**Expert thinking patterns look like**:

```markdown
Before [action], ask yourself:

- **Purpose**: What problem does this solve? Who uses it?
- **Constraints**: What are the hidden requirements?
- **Differentiation**: What makes this solution memorable?
```

**The test**:

1. Does it tell the model WHAT to think about? (thinking patterns)
2. Does it tell the model HOW to do things it wouldn't know? (domain procedures)

**User input in pi**: Pi has no structured question tool. Skills should ask clearly in
conversation with explicit options when the valid set is known. The preference persistence
question still applies:

| Scope   | Lifetime              | Where to store in pi context         | Example                             |
| ------- | --------------------- | ------------------------------------ | ----------------------------------- |
| Session | Dies with the process | Conversation context                 | "Which file to analyze?"            |
| Project | Same within a repo    | AGENTS.md or project config          | "Use full or lightweight workflow?" |
| User    | Same everywhere       | `~/.pi/agent/` config or AGENTS.md   | "Preferred output format"           |

If a skill re-asks a question whose answer rarely changes, it should persist the answer at the
appropriate scope or make the default correct.

---

## D3: Anti-Pattern Quality

Half of expert knowledge is knowing what NOT to do. The model hasn't stepped on the landmines —
it doesn't know which patterns lead to orphan processes or which review-bot behaviors are false
positives.

**Expert anti-patterns** (specific + reason):

```markdown
NEVER spawn a bot review if CI is still running from the self-review push.
Wait for CI to settle (15s minimum) or the bot may review stale code.
```

**Weak anti-patterns** (no value):

```markdown
Avoid mistakes. Be careful with edge cases. Don't write bad code.
```

**The test**: Would an expert say "yes, I learned this the hard way"? Or "this is obvious to
everyone"?

---

## D4: Specification Compliance

**Pi frontmatter requirements**:

- `name`: lowercase, alphanumeric + hyphens only, ≤64 characters
- `description`: answers WHAT, WHEN, and contains KEYWORDS
- `allowed-tools` (optional): advisory list of tools the skill uses

**Pi activation flow**:

```text
User Request → Agent sees <available_skills> block → Matches description → Loads SKILL.md
               (only name + description visible at decision time!)

If description doesn't match → Skill NEVER gets loaded
If description is vague → Skill might not trigger when it should
```

**Description must answer THREE questions**:

1. **WHAT**: What does this Skill do?
2. **WHEN**: In what situations should it be used?
3. **KEYWORDS**: What terms should trigger this Skill?

**Good description**:

```yaml
description: "Run a sequential implementation pipeline across multiple GitHub issues.
Use when asked to implement a batch of issues end-to-end, run an implementation loop,
or automate a series of issues through the full PR lifecycle.
Triggers on: implementation loop, batch issues, sequential implementation, pipeline."
```

**Description quality checklist**:

- [ ] Lists specific capabilities (not just "helps with X")
- [ ] Includes explicit trigger scenarios ("Use when...", "When user asks for...")
- [ ] Contains searchable keywords (domain terms, action verbs)
- [ ] Includes scenarios where this skill MUST be used

---

## D5: Progressive Disclosure

**Pi three-layer model**:

```text
Layer 1: Metadata (in <available_skills>) — name + description only (~100 tokens)
Layer 2: SKILL.md Body — loaded via --skill flag or agent decision (ideal: <500 lines)
Layer 3: references/ — loaded on demand via `read` tool (no limit)
```

**Loading trigger quality**:

| Quality   | Characteristics                               |
| --------- | --------------------------------------------- |
| Poor      | References listed at end, no loading guidance |
| Mediocre  | Some triggers but not embedded in workflow    |
| Good      | MANDATORY triggers in workflow steps          |
| Excellent | Conditional triggers + "Do NOT Load" guidance |

**Good loading trigger** (embedded in workflow):

```markdown
**MANDATORY — READ ENTIRE FILE**: Load `references/pipeline-script-template.md` before
generating the script.

**Do NOT load** `references/usage-examples.md` during generation — it is user-facing
documentation only.
```

**Bad loading trigger** (just listed):

```markdown
## References

- pipeline-script-template.md - the script template
- usage-examples.md - examples
```

---

## D6: Freedom Calibration

**The freedom spectrum**:

| Task Type              | Freedom | Why                                                 |
| ---------------------- | ------- | --------------------------------------------------- |
| Creative/Design        | High    | Multiple valid approaches, differentiation is value |
| Code review            | Medium  | Principles exist but judgment required              |
| Process orchestration  | Low     | One wrong step corrupts state or orphans processes  |
| File format operations | Low     | One wrong byte corrupts file                        |

**The test**: Ask "if the agent makes a mistake, what's the consequence?"

- High consequence → Low freedom (exact scripts)
- Low consequence → High freedom (principles)

---

## D7: Pattern Recognition

**6 patterns for pi skills**:

| Pattern      | ~Lines | Use When                                     |
| ------------ | ------ | -------------------------------------------- |
| Mindset      | ~50    | Creative tasks requiring taste               |
| Navigation   | ~30    | Multiple distinct scenarios                  |
| Philosophy   | ~150   | Art/creation requiring originality           |
| Process      | ~200   | Complex multi-step projects                  |
| Tool         | ~300   | Precise operations on specific formats       |
| Orchestrator | ~250   | Spawns/manages other agents or processes     |

**Orchestrator pattern** (pi-specific): Skills that spawn background `pi` instances, manage
tmux sessions, poll for completion, steer via control files, and produce handoff reports.
Key characteristics:
- Mode selection (orchestrator vs worker)
- Process lifecycle management (PID tracking, cleanup traps)
- Status observability (machine-readable status files)
- Steering mechanisms (control files, pause/resume)
- Handoff contracts between spawner and worker

---

## D8: Practical Usability

**Check for**:

- Decision trees for multi-path scenarios
- Working code examples (not pseudocode that breaks)
- Fallbacks when the main approach fails
- Edge cases coverage
- Can the agent immediately act, or does it need to figure things out?
- **Persistent state stability**: if the skill writes to a file path derived at runtime, would two
  sessions in different directories of the same repo resolve to the same path? (`pwd` breaks in
  worktrees; `git rev-parse --show-toplevel` is stable)

**Good usability** (decision tree + fallback):

```markdown
| Failure              | Action                    | Fallback              |
| -------------------- | ------------------------- | --------------------- |
| Agent times out      | Kill PID, skip issue      | Log error, continue   |
| Merge conflicts      | Skip merge                | Manual rebase needed  |
| CI not green         | Wait 30s, retry           | Skip merge            |
```

---

## D9: Delegation & Process Lifecycle (pi-specific)

**Only score when the skill spawns processes or delegates to sub-agents.**

**Red flags** (instant score ≤3):

- `nohup ... &` without a trap handler
- No PID tracking array
- No dead-agent detection in wait loops
- Handoff file expected but no timeout or fallback
- Worker prompts that could trigger further delegation (unbounded depth)
- Script generation from templates instead of static scripts with config input

**Green flags** (high score):

- `trap cleanup EXIT INT TERM` with PID kill loop
- `wait_for_handoff` with dead-PID early-exit (`kill -0` check)
- Machine-readable status file updated at each phase transition
- Control file for runtime steering (pause/skip/abort)
- Heartbeat logging during long waits
- Worker prompts that explicitly say "do not spawn another instance"
- Handoff contract clearly documented (what fields, what format)
- **Static executable script** that the agent invokes with a config file (not generates)
- Config validation at startup with clear error messages
- Script is lintable (shellcheck-clean) and testable independently of the agent

**Static scripts vs generated scripts**:

This is a hard rule, not a preference. If a skill orchestrates processes via bash:

| Approach | Verdict |
|----------|--------|
| Static script + config file input | Correct — testable, fixable, agent-proof |
| Template with `<BRACKETS>` for agent substitution | Wrong — untested, fragile, agent can hallucinate logic |
| Agent generates script from prose instructions | Worst — completely unreproducible |

The agent’s job when using an Orchestrator skill is to WRITE DATA (config) and INVOKE a program
(the static script). The agent must NEVER write or modify the program itself. This separation
prevents the most common orchestrator failure mode: the agent "helpfully" adjusting pipeline
logic while filling in a template, introducing subtle behavioral changes that no test catches.

Deduct 3-4 points from D9 if a skill uses template-based script generation when a static script
with config input would work. Deduct the full dimension (score 0-2) if the skill has the agent
generate arbitrary bash from prose instructions.

**Evaluation questions**:

1. If the orchestrating session is killed, do child processes keep running?
2. If a child agent dies without writing a handoff, how long before the pipeline notices?
3. Can the invoking session monitor progress without attaching to the child?
4. Is there a way to steer (skip, pause, abort) without killing everything?
5. Is delegation depth bounded?
6. Is the orchestration script a tested, static artifact? Or is it generated per-run?
7. Can the script be validated independently (`bash -n`, `shellcheck`)?

**The test**: Run the mental model of "kill -9 the parent at every phase boundary" and check
if the skill's design handles each scenario. Then ask: "If I run this skill 10 times, do I
get the same script 10 times?" If yes (static) — good. If no (generated) — bad.
