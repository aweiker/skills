---
name: skill-judge
description: >
  Evaluate pi skill design quality against best practices and operational patterns. Use when:
  reviewing or auditing a SKILL.md file, scoring skill quality, asking "is this a good skill?",
  improving skill design, or checking if a skill follows patterns. Triggers on: SKILL.md, skill
  review, skill audit, skill score, knowledge delta, skill judge, evaluate skill, improve skill, fix
  skill, rewrite skill, judge skill. Do NOT use for general code review, bug hunting, security
  audits, or reviewing code that is not a SKILL.md — this evaluates Skill design quality, not code
  quality.
---

# Skill Judge

Evaluate pi skills against operational patterns derived from production agent workflows.
12 failure patterns codified, adapted for pi's tool model and delegation capabilities.

---

## Core Philosophy

> **Good Skill = Expert-only Knowledge − What the model already knows**

Redundant content wastes context that is shared across system prompts, conversation history, and
other Skills. Categorize every section as **[E] Expert** (keep), **[A] Activation** (keep if brief),
or **[R] Redundant** (delete). Target: >70% Expert, <20% Activation, <10% Redundant.

---

## Pi-Specific Skill Model

Pi skills differ from other agent frameworks in key ways:

- **Tool model**: Pi provides `bash`, `read`, `write`, `edit`, and `subagent` as core tools.
  There is no structured `AskUserQuestion` — the agent asks inline in conversation.
- **Activation**: Pi shows `name + description` in `<available_skills>` in the system prompt.
  The agent decides whether to load the skill based solely on this block. Once activated,
  the full SKILL.md body is loaded. References are loaded via `read` tool calls.
- **Delegation**: Pi has `subagent` for spawning isolated sub-agents (single, parallel, chain).
  Skills that orchestrate complex work should evaluate delegation opportunities.
- **Sessions**: Pi supports `--session-id` for persistent sessions and `--approve` for
  non-interactive execution. Skills that spawn workers need to account for this.
- **Process lifecycle**: Pi skills that spawn background processes (`nohup`, `&`, tmux) must
  handle PID cleanup, orphan detection, and handoff files as completion signals.
- **No per-tool prompting**: Pi does not prompt for permission per tool. The `allowed-tools`
  frontmatter field is advisory documentation, not a permission gate.

---

## Evaluation Dimensions (130 points total)

Detail on each dimension's red flags, examples, and anti-pattern tests is in
[`references/dimensions.md`](references/dimensions.md) — loaded conditionally at Step 3.

### D1: Knowledge Delta (20 points) — THE CORE DIMENSION

| Score | Criteria                                                             |
| ----- | -------------------------------------------------------------------- |
| 0-5   | Explains basics the model knows (what is X, standard library tutorials) |
| 6-10  | Mixed: some expert knowledge diluted by obvious content              |
| 11-15 | Mostly expert knowledge with minimal redundancy                      |
| 16-20 | Pure knowledge delta — every paragraph earns its tokens              |

### D2: Mindset + Appropriate Procedures (15 points)

| Score | Criteria                                                                   |
| ----- | -------------------------------------------------------------------------- |
| 0-3   | Only generic procedures the model already knows                            |
| 4-7   | Has domain procedures but lacks thinking frameworks                        |
| 8-11  | Good balance: thinking patterns + domain-specific workflows                |
| 12-15 | Expert-level: shapes thinking AND provides procedures the model wouldn't know |

**User input pattern**: When a skill needs to collect choices from the user, it should ask
clearly with explicit options in the conversation flow. Deduct 1-2 points from D2 when a
skill solicits ambiguous choices without providing the valid option set.

### D3: Anti-Pattern Quality (15 points)

| Score | Criteria                                                               |
| ----- | ---------------------------------------------------------------------- |
| 0-3   | No anti-patterns mentioned                                             |
| 4-7   | Generic warnings ("avoid errors", "be careful", "consider edge cases") |
| 8-11  | Specific NEVER list with some reasoning                                |
| 12-15 | Expert-grade anti-patterns with WHY — things only experience teaches   |

### D4: Specification Compliance — Especially Description (15 points)

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

### D5: Progressive Disclosure (15 points)

| Score | Criteria                                                             |
| ----- | -------------------------------------------------------------------- |
| 0-5   | Everything dumped in SKILL.md (>500 lines, no structure)             |
| 6-10  | Has references but unclear when to load them                         |
| 11-13 | Good layering with MANDATORY triggers present                        |
| 14-15 | Perfect: decision trees + explicit triggers + "Do NOT Load" guidance |

### D6: Freedom Calibration (15 points)

| Score | Criteria                                                                      |
| ----- | ----------------------------------------------------------------------------- |
| 0-5   | Severely mismatched (rigid scripts for creative tasks, vague for fragile ops) |
| 6-10  | Partially appropriate, some mismatches                                        |
| 11-13 | Good calibration for most scenarios                                           |
| 14-15 | Perfect freedom calibration throughout                                        |

### D7: Pattern Recognition (10 points)

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

### D8: Practical Usability (15 points)

| Score | Criteria                                                       |
| ----- | -------------------------------------------------------------- |
| 0-5   | Confusing, incomplete, contradictory, or untested guidance     |
| 6-10  | Usable but with noticeable gaps                                |
| 11-13 | Clear guidance for common cases                                |
| 14-15 | Comprehensive coverage including edge cases and error handling |

### D9: Delegation & Process Lifecycle (10 points) — PI-SPECIFIC

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

**When evaluating an unfamiliar domain**: weight D4, D5, D7, and D8 heavily — these are
domain-agnostic. Flag D1, D2, and D3 as "domain expertise required" and note the limitation in your
report rather than guessing.

---

## NEVER Do When Evaluating

- **NEVER** give high scores because it looks professional — LLMs are trained to produce polished
  output, so surface quality is a systematically misleading signal
- **NEVER** ignore token waste — every redundant paragraph competes with user input and system
  prompts for the same fixed context window
- **NEVER** let length impress you — a 43-line Skill can outperform a 500-line Skill because density
  of expert knowledge matters more than volume
- **NEVER** skip mentally testing the decision trees — a tree that leads to the wrong choice is
  worse than no tree, because it creates false confidence
- **NEVER** forgive explaining basics with "but it provides helpful context" — the model already has
  that context; restating it wastes tokens and dilutes the expert signal
- **NEVER** overlook missing anti-patterns — their absence means the Skill omits half of expert
  knowledge (knowing what NOT to do)
- **NEVER** assume all procedures are valuable — generic file ops and standard patterns the model
  already knows add weight without adding knowledge (see Pattern 4: The Checkbox Procedure)
- **NEVER** undervalue the description field — a Skill with great content but poor description is
  never activated and therefore completely useless (see Pattern 6: The Invisible Skill)
- **NEVER** put "when to use" info only in the body — the Agent decides whether to load the Skill
  based on the description alone; body content is invisible at that decision point (see Pattern 7:
  The Wrong Location)
- **NEVER** score D5 above 10 because `references/` exists — orphan references (Pattern 3) are worse
  than no references because they create false confidence; verify each file has an explicit
  MANDATORY trigger before awarding points above 10
- **NEVER** ignore process lifecycle in Orchestrator-pattern skills — a skill that spawns processes
  without PID cleanup, handoff contracts, and orphan detection is a production hazard regardless
  of how clean its knowledge delta is
- **NEVER** penalize a skill for not using `subagent` — delegation is an optimization, not a
  requirement. Only flag it when a skill tries to do too much inline and clearly exceeds what a
  single context window can handle reliably.
- **NEVER** accept template-based script generation in Orchestrator skills as acceptable design.
  If the skill has the agent substitute `<BRACKETS>` in a template to produce a runnable script,
  that is Pattern 16 (The Generated Script) and D9 should be penalized. The correct design is a
  static, tested script that accepts a config file as input.

---

## When Blocked

| Blocker                                            | Recovery                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| File is not named `SKILL.md` (e.g. `skill.md`)     | Flag immediately — pi only loads `SKILL.md` (exact case); score D4 at 0    |
| SKILL.md has no frontmatter                        | Score D4 at 0, note "invalid format", evaluate remaining dimensions         |
| SKILL.md is empty or missing                       | Cannot evaluate — ask user to provide the file                              |
| Skill spans multiple files (commands/, sub-skills) | Evaluate SKILL.md as the entry point; score sub-files under D5              |
| Domain is completely unfamiliar                    | Cap D1/D2/D3 at 10, flag "domain expertise required" in each                |
| No `references/` directory                         | Score D5 on SKILL.md structure alone — not every skill needs references     |

---

## Evaluation Protocol

Before starting, orient your mindset:

- **What is the single most expensive mistake an evaluator could make here?** Inflating scores
  because the output looks polished — LLMs produce professional-looking content by default, so
  surface quality is a systematically misleading signal. Hold this thought through every step.
- **Do I know this domain well enough to judge knowledge delta?** If not, flag D1/D2/D3 as "domain
  expertise required" and weight D4/D5/D7/D8 more heavily.
- **What pattern does this Skill appear to be targeting?** Identify it before scoring so you can
  hold it against the right standard.
- **Does this skill spawn processes or delegate work?** If yes, D9 applies.
- **What would an expert in this domain already know?** This sets your baseline for D1.

### Step 1: First Pass — Knowledge Delta Scan

**Do NOT load** any reference files during this step.

For each section, ask: "If this section were deleted entirely, would the model produce a worse
result?" If no → mark it [R]. Then read the whole file and classify:

Mark each section as:

- **[E] Expert**: The model genuinely doesn't know this — value-add
- **[A] Activation**: The model knows but brief reminder is useful — acceptable
- **[R] Redundant**: The model definitely knows this — should be deleted

Calculate rough ratio: E:A:R

- Good Skill: >70% Expert, <20% Activation, <10% Redundant
- Mediocre Skill: 40-70% Expert, high Activation
- Bad Skill: <40% Expert, high Redundant

### Step 2: Structure Analysis

**Do NOT load** `references/dimensions.md`, `references/failure-patterns.md`, or
`references/quick-reference.md` during this step.

If SKILL.md is near 300 lines, ask: "Which sections are activation-weight that could move to
`references/` without breaking the step-by-step flow?" Note them before scoring.

```text
[ ] Check frontmatter validity (name + description required)
[ ] Count total lines in SKILL.md
[ ] List all reference files and their sizes
[ ] Identify which pattern the Skill follows
[ ] Check for loading triggers (if references exist)
[ ] Does the skill spawn processes? (D9 applicability)
```

### Step 3: Score Each Dimension

**MANDATORY**: Before scoring, read
[`references/failure-patterns.md`](references/failure-patterns.md) in full — it contains the
failure patterns to check against each dimension.

If any dimension score falls below 12, or the domain is unfamiliar: **MANDATORY**: read
[`references/dimensions.md`](references/dimensions.md) for that dimension's failure mode examples
before finalizing the score.

**Do NOT load** `references/quick-reference.md` at this stage.

For each applicable dimension:

1. Before assigning a score, ask: "Would removing this section make the Skill meaningfully worse? If
   no, it's redundant — regardless of how polished it looks."
2. Find specific evidence (quote relevant lines)
3. Assign score with one-line justification
4. Note specific improvements if score < max

### Step 4: Calculate Total & Grade

```text
Total = D1 + D2 + D3 + D4 + D5 + D6 + D7 + D8 + D9
Max = 130 points (or 120 if D9 is N/A)
```

**Grade Scale** (adjust percentage if D9 is N/A):

| Grade | Percentage | Meaning                                   |
| ----- | ---------- | ----------------------------------------- |
| A     | ≥90%       | Excellent — production-ready expert Skill |
| B     | 80-89%     | Good — minor improvements needed          |
| C     | 70-79%     | Adequate — clear improvement path         |
| D     | 60-69%     | Below Average — significant issues        |
| F     | <60%       | Poor — needs fundamental redesign         |

### Step 5: Generate Report

**MANDATORY**: Load [`references/quick-reference.md`](references/quick-reference.md). It contains
the evaluation checklist and the full report template. Write the report using that template — do not
wrap it in a code fence.

### Step 6: Re-evaluation (iterative loop)

If the user applies improvements and asks to re-evaluate:

1. Run Steps 1–5 again on the updated SKILL.md
2. Compare each dimension score against the previous report — note delta per dimension
3. Focus analysis only on dimensions that changed; skip unchanged dimensions unless they regressed
4. Update the verdict to reflect net direction: "improved from B→A" or "D2 regressed due to X"

**Mixed results**: When one dimension improves while another regresses, report both explicitly. A
net-positive total does not excuse a regression — the user should decide whether the trade-off is
acceptable.

**Diminishing returns**: If the total score changed by ≤2 points across a re-evaluation cycle, say
so: "Score is stable — remaining improvements are polish, not structure." Do not push for a third
iteration unless the user asks.

Do not re-read reference files that were already loaded in this session unless the Skill structure
changed significantly.
