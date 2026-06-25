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
16 failure patterns codified, adapted for pi's tool model and delegation capabilities.

---

## Core Philosophy

> **Good Skill = Expert-only Knowledge − What the model already knows**

Redundant content wastes context shared across system prompts, conversation history, and other
Skills. Categorize every section as **[E] Expert** (keep), **[A] Activation** (keep if brief),
or **[R] Redundant** (delete). Target: >70% Expert, <20% Activation, <10% Redundant.

---

## Pi-Specific Skill Model

Pi skills differ from other agent frameworks in key ways:

- **Tool model**: `bash`, `read`, `write`, `edit`, and `subagent`. No structured
  `AskUserQuestion` — the agent asks inline in conversation.
- **Activation**: `<available_skills>` block shows `name + description` only. The agent
  decides whether to load the skill based solely on this block.
- **Delegation**: `subagent` spawns isolated sub-agents (single, parallel, chain).
- **Sessions**: `--session-id` for persistence, `--approve` for non-interactive execution.
- **Process lifecycle**: Skills that spawn background processes must handle PID cleanup,
  orphan detection, and handoff files as completion signals.
- **No per-tool prompting**: `allowed-tools` is advisory documentation, not a permission gate.

---

## Evaluation Dimensions (130 points total, or 120 if D9 is N/A)

9 dimensions. Full scoring rubrics with worked examples are in
[`references/scoring-rubrics.md`](references/scoring-rubrics.md) — **MANDATORY** load at Step 3.

| Dimension | Max | Core question |
| --------- | --- | ------------- |
| D1: Knowledge Delta | 20 | Does the model genuinely not know this? |
| D2: Mindset + Procedures | 15 | Does it shape WHAT to think about + HOW to do non-obvious things? |
| D3: Anti-Pattern Quality | 15 | Are the NEVER items specific, with WHY? |
| D4: Specification Compliance | 15 | Does the description answer WHAT, WHEN, KEYWORDS? |
| D5: Progressive Disclosure | 15 | Is heavy content in references with explicit load triggers? |
| D6: Freedom Calibration | 15 | High freedom for creative, low for fragile? |
| D7: Pattern Recognition | 10 | Does it cleanly follow Mindset/Navigation/Philosophy/Process/Tool/Orchestrator? |
| D8: Practical Usability | 15 | Can the agent immediately act without figuring things out? |
| D9: Delegation & Lifecycle | 10 | (If applicable) Static script, PID cleanup, handoff contracts? |

**D9 applicability**: Only score when the skill spawns processes, delegates to subagents, or
manages long-running workflows. Otherwise N/A (max becomes 120).

---

## NEVER Do When Evaluating

- **NEVER** give high scores because it looks professional — LLMs produce polished output by
  default, so surface quality is a systematically misleading signal
- **NEVER** ignore token waste — every redundant paragraph competes with user input for the
  same fixed context window
- **NEVER** let length impress you — a 43-line Skill can outperform a 500-line Skill because
  density of expert knowledge matters more than volume
- **NEVER** assume short = incomplete — if every line is expert knowledge, the skill is excellent
  regardless of length
- **NEVER** skip mentally testing the decision trees — a tree that leads to the wrong choice is
  worse than no tree (false confidence)
- **NEVER** forgive explaining basics with "but it provides helpful context" — the model already
  has that context; restating it wastes tokens
- **NEVER** overlook missing anti-patterns — their absence means the Skill omits half of expert
  knowledge (knowing what NOT to do)
- **NEVER** assume all procedures are valuable — generic file ops and standard patterns the model
  already knows add weight without adding knowledge (Pattern 4: The Checkbox Procedure)
- **NEVER** undervalue the description field — a Skill with great content but poor description is
  never activated and therefore useless (Pattern 6: The Invisible Skill)
- **NEVER** put "when to use" info only in the body — the agent decides based on the description
  alone; body content is invisible at that decision point (Pattern 7: The Wrong Location)
- **NEVER** score D5 above 10 because `references/` exists — orphan references (Pattern 3) are
  worse than no references; verify each file has an explicit MANDATORY trigger
- **NEVER** ignore process lifecycle in Orchestrator-pattern skills — a skill that spawns
  processes without PID cleanup is a production hazard regardless of knowledge delta
- **NEVER** penalize for not using `subagent` — delegation is an optimization, not a requirement
- **NEVER** accept template-based script generation in Orchestrator skills — if the agent
  substitutes `<BRACKETS>` in a template to produce a runnable script, that is Pattern 16 (The
  Generated Script) and D9 should be penalized

---

## When Blocked

| Blocker | Recovery |
| ------- | -------- |
| Not named `SKILL.md` | Score D4 at 0 — pi only loads exact `SKILL.md` |
| No frontmatter | Score D4 at 0, evaluate remaining dimensions |
| Empty or missing | Cannot evaluate — ask user for the file |
| Multiple files | Evaluate SKILL.md as entry point; sub-files under D5 |
| Unfamiliar domain | Cap D1/D2/D3 at 10; weight D4/D5/D7/D8 heavily |
| No `references/` | Score D5 on SKILL.md structure alone |

---

## Evaluation Protocol

Before starting, orient:

- **Inflation risk**: LLMs produce professional-looking content — hold this bias check through
  every step.
- **Domain familiarity**: If unfamiliar, flag D1/D2/D3 as "domain expertise required."
- **Pattern identification**: What pattern is this skill targeting? Identify before scoring.
- **D9 applicability**: Does it spawn processes or delegate? If yes, D9 applies.

### Step 1: First Pass — Knowledge Delta Scan

**Do NOT load** any reference files during this step.

For each section, ask: "If deleted entirely, would the model produce a worse result?"
If no → mark it [R].

- **[E] Expert**: The model genuinely doesn't know this
- **[A] Activation**: The model knows but brief reminder is useful
- **[R] Redundant**: The model definitely knows this — should be deleted

Target ratio: >70% E, <20% A, <10% R.

### Step 2: Structure Analysis

**Do NOT load** any reference files during this step.

```text
[ ] Frontmatter valid (name + description)
[ ] Total lines in SKILL.md
[ ] List reference files and sizes
[ ] Identify pattern (Mindset/Navigation/Philosophy/Process/Tool/Orchestrator)
[ ] Verify loading triggers exist for each reference
[ ] D9 applicability check
```

If SKILL.md exceeds 300 lines: identify which sections are activation-weight and could move to
references without breaking the workflow flow.

### Step 3: Score Each Dimension

**MANDATORY**: Load [`references/scoring-rubrics.md`](references/scoring-rubrics.md) — it
contains the full rubric tables and a worked scoring example.

**MANDATORY**: Load [`references/failure-patterns.md`](references/failure-patterns.md) — it
contains the 16 failure patterns to check against each dimension.

If any dimension scores below 12, or the domain is unfamiliar: **MANDATORY** also load
[`references/dimensions.md`](references/dimensions.md) for that dimension's deep-dive examples.

**Do NOT load** `references/quick-reference.md` at this stage.

For each applicable dimension:

1. Ask: "Would removing this section make the Skill meaningfully worse?"
2. Find specific evidence (quote lines)
3. Assign score with one-line justification
4. Note improvements if score < max

### Step 4: Calculate Total & Grade

```text
Total = D1 + D2 + D3 + D4 + D5 + D6 + D7 + D8 [+ D9 if applicable]
Max = 130 (or 120 if D9 N/A)
Percentage = Total / Max × 100
```

| Grade | Percentage | Meaning |
| ----- | ---------- | ------- |
| A | ≥90% | Excellent — production-ready |
| B | 80-89% | Good — minor improvements needed |
| C | 70-79% | Adequate — clear improvement path |
| D | 60-69% | Below Average — significant issues |
| F | <60% | Poor — needs fundamental redesign |

### Step 5: Generate Report

**MANDATORY**: Load [`references/quick-reference.md`](references/quick-reference.md) for the
report template and checklist. Write the report using that template.

### Step 6: Re-evaluation (iterative loop)

If the user applies improvements and asks to re-evaluate:

1. Re-run Steps 1–5 on the updated SKILL.md
2. Compare each dimension score — note deltas
3. Focus only on changed dimensions unless regression detected
4. Report direction: "improved from B→A" or "D2 regressed due to X"

**Mixed results**: Report improvements AND regressions explicitly. Net-positive total does not
excuse a regression.

**Diminishing returns**: If total changed by ≤2 points, say: "Score is stable — remaining
improvements are polish, not structure." Do not push for a third iteration unless asked.
