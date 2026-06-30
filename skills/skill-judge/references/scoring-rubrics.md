# Scoring Rubrics

Load this file at Step 3 before scoring each dimension.

---

## D1: Knowledge Delta (20 points) — THE CORE DIMENSION

| Score | Criteria                                                             |
| ----- | -------------------------------------------------------------------- |
| 0-5   | Explains basics the model knows (what is X, standard library tutorials) |
| 6-10  | Mixed: some expert knowledge diluted by obvious content              |
| 11-15 | Mostly expert knowledge with minimal redundancy                      |
| 16-20 | Pure knowledge delta — every paragraph earns its tokens              |

## D2: Mindset + Appropriate Procedures (15 points)

| Score | Criteria                                                                   |
| ----- | -------------------------------------------------------------------------- |
| 0-3   | Only generic procedures the model already knows                            |
| 4-7   | Has domain procedures but lacks thinking frameworks                        |
| 8-11  | Good balance: thinking patterns + domain-specific workflows                |
| 12-15 | Expert-level: shapes thinking AND provides procedures the model wouldn't know |

**User input pattern**: When a skill needs to collect choices from the user, it should ask
clearly with explicit options in the conversation flow. Deduct 1-2 points from D2 when a
skill solicits ambiguous choices without providing the valid option set.

## D3: Anti-Pattern Quality (15 points)

| Score | Criteria                                                               |
| ----- | ---------------------------------------------------------------------- |
| 0-3   | No anti-patterns mentioned                                             |
| 4-7   | Generic warnings ("avoid errors", "be careful", "consider edge cases") |
| 8-11  | Specific NEVER list with some reasoning                                |
| 12-15 | Expert-grade anti-patterns with WHY — things only experience teaches   |

## D4: Specification Compliance — Especially Description (15 points)

| Score | Criteria                                                                 |
| ----- | ------------------------------------------------------------------------ |
| 0-5   | Missing frontmatter or invalid format                                    |
| 6-10  | Has frontmatter but description is vague or incomplete                   |
| 11-13 | Valid frontmatter, description has WHAT but weak on WHEN                 |
| 14-15 | Perfect: comprehensive description with WHAT, WHEN, and trigger keywords |

**Pi frontmatter fields**:
- `name` (required): lowercase, alphanumeric + hyphens, ≤64 chars
- `description` (required): answers WHAT, WHEN, and contains KEYWORDS
- `allowed-tools` (optional, advisory): documents which tools the skill uses

The description is the activation surface — it determines whether the skill gets loaded.
Everything else is invisible until activation.

## D5: Progressive Disclosure (15 points)

| Score | Criteria                                                             |
| ----- | -------------------------------------------------------------------- |
| 0-5   | Everything dumped in SKILL.md (>500 lines, no structure)             |
| 6-10  | Has references but unclear when to load them                         |
| 11-13 | Good layering with MANDATORY triggers present                        |
| 14-15 | Perfect: decision trees + explicit triggers + "Do NOT Load" guidance |

## D6: Freedom Calibration (15 points)

| Score | Criteria                                                                      |
| ----- | ----------------------------------------------------------------------------- |
| 0-5   | Severely mismatched (rigid scripts for creative tasks, vague for fragile ops) |
| 6-10  | Partially appropriate, some mismatches                                        |
| 11-13 | Good calibration for most scenarios                                           |
| 14-15 | Perfect freedom calibration throughout                                        |

## D7: Pattern Recognition (10 points)

| Pattern      | ~Lines | When to Use                                  |
| ------------ | ------ | -------------------------------------------- |
| Mindset      | ~50    | Creative tasks requiring taste               |
| Navigation   | ~30    | Multiple distinct scenarios                  |
| Philosophy   | ~150   | Art/creation requiring originality           |
| Process      | ~200   | Complex multi-step projects                  |
| Tool         | ~300   | Precise operations on specific formats       |
| Orchestrator | ~250   | Spawns/manages other agents or processes     |

| Score | Criteria                                                |
| ----- | ------------------------------------------------------- |
| 0-3   | No recognizable pattern, chaotic structure              |
| 4-6   | Partially follows a pattern with significant deviations |
| 7-8   | Clear pattern with minor deviations                     |
| 9-10  | Masterful application of appropriate pattern            |

**Pattern tie-breaking**: When a Skill sits between two patterns, ask:

- Tool vs Process: Does it center on a decision tree with format constraints (→ Tool) or a workflow
  with checkpoints and phase gates (→ Process)?
- Process vs Orchestrator: Does the skill do the work itself (→ Process) or spawn other agents/
  processes to do it (→ Orchestrator)?
- Mindset vs Philosophy: Is the goal taste/judgment (→ Mindset) or originality and craft quality (→
  Philosophy)?
- Any pattern vs Navigation: Does it contain multiple distinct sub-scenarios that each need their
  own guidance file (→ Navigation)?

## D8: Practical Usability (15 points)

| Score | Criteria                                                       |
| ----- | -------------------------------------------------------------- |
| 0-5   | Confusing, incomplete, contradictory, or untested guidance     |
| 6-10  | Usable but with noticeable gaps                                |
| 11-13 | Clear guidance for common cases                                |
| 14-15 | Comprehensive coverage including edge cases and error handling |

## D9: Delegation & Process Lifecycle (10 points) — PI-SPECIFIC

| Score | Criteria                                                                  |
| ----- | ------------------------------------------------------------------------- |
| 0-2   | Spawns processes without cleanup; no handoff contract; orphan risk        |
| 3-5   | Has basic cleanup but missing edge cases (PID reuse, partial handoffs)   |
| 6-8   | Proper PID management, handoff contracts, and timeout handling           |
| 9-10  | Expert: dead-agent detection, control-file steering, status observability |

**When to apply D9**: Only score this dimension when the skill spawns background processes,
delegates to subagents, or manages long-running workflows. For skills that do all work inline
(Mindset, Tool, most Navigation patterns), score D9 as N/A and adjust the max total to 120.

**Static script rule**: If the skill orchestrates via bash, it MUST ship a static executable
script and have the agent write only a config file. Template-based script generation (agent
substitutes `<BRACKETS>`) is a scoring penalty: -3 to -4 points. Agent-generated arbitrary
bash from prose is an automatic 0-2.

---

## Worked Example: Scoring D3 on a real skill

Given a skill with this NEVER section:

```markdown
## NEVER

- Don't make mistakes
- Be careful with edge cases
- Avoid common pitfalls
```

**Score: 4/15** — Has a NEVER section (not 0-3) but every item is vague. No specifics, no WHY.
A model would produce identical output without this section. It's noise, not knowledge.

Now compare with:

```markdown
## NEVER

- NEVER spawn a bot review if CI is still running from the self-review push.
  Wait 15s minimum or the bot reviews stale code and generates false findings.
- NEVER paste another skill's full prompt contract into your template.
  The owning skill manages its own prompt — copies drift silently when the
  source updates. Pass only variable inputs.
- NEVER use `gh pr merge --delete-branch` when the branch is checked out in a
  worktree. The command succeeds on the merge but exits non-zero on the
  branch delete, which kills the script under `set -e`.
```

**Score: 14/15** — Three items, each with a specific scenario, a WHY that requires experience
to learn, and an actionable alternative. An expert would say "yes, I learned these the hard way."
One point short of 15 because three items is thin coverage — a 15/15 skill has 8+ NEVER items
covering the full failure surface.

**The calibration question at each score band:**
- 0-3: "Does a NEVER section exist at all?"
- 4-7: "Are the items specific enough that I could write a test for each?"
- 8-11: "Would an expert nod and say 'yes, that's hard-won knowledge'?"
- 12-15: "Would an expert say 'this covers the failures I've seen in production'?"
