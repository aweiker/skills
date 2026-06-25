# Skill Evaluation Quick Reference

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  PI SKILL EVALUATION QUICK CHECK                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  KNOWLEDGE DELTA (most important):                                      │
│    [ ] No "What is X" explanations for basic concepts                   │
│    [ ] No step-by-step tutorials for standard operations                │
│    [ ] Has decision trees for non-obvious choices                       │
│    [ ] Has trade-offs only experts would know                           │
│    [ ] Has edge cases from real-world experience                        │
│                                                                         │
│  MINDSET + PROCEDURES:                                                  │
│    [ ] Transfers thinking patterns (how to think about problems)        │
│    [ ] Has "Before doing X, ask yourself..." frameworks                 │
│    [ ] Includes domain-specific procedures the model wouldn't know      │
│    [ ] Distinguishes valuable procedures from generic ones              │
│                                                                         │
│  ANTI-PATTERNS:                                                         │
│    [ ] Has explicit NEVER list                                          │
│    [ ] Anti-patterns are specific, not vague                            │
│    [ ] Includes WHY (non-obvious reasons)                               │
│                                                                         │
│  SPECIFICATION (description is critical!):                              │
│    [ ] Valid YAML frontmatter (name + description required)             │
│    [ ] name: lowercase, ≤64 chars                                       │
│    [ ] description answers: WHAT does it do?                            │
│    [ ] description answers: WHEN should it be used?                     │
│    [ ] description contains trigger KEYWORDS                            │
│    [ ] description is specific enough for agent to know when to use     │
│                                                                         │
│  STRUCTURE:                                                             │
│    [ ] SKILL.md < 500 lines (ideal < 300)                               │
│    [ ] Heavy content in references/                                     │
│    [ ] Loading triggers embedded in workflow (MANDATORY / Do NOT Load)  │
│    [ ] Has "Do NOT Load" for preventing over-loading                    │
│                                                                         │
│  FREEDOM:                                                               │
│    [ ] Creative tasks → High freedom (principles)                       │
│    [ ] Fragile operations → Low freedom (exact scripts)                 │
│                                                                         │
│  USABILITY:                                                             │
│    [ ] Decision trees for multi-path scenarios                          │
│    [ ] Working code examples                                            │
│    [ ] Error handling and fallbacks                                     │
│    [ ] Edge cases covered                                               │
│                                                                         │
│  DELEGATION (if skill spawns processes — D9):                           │
│    [ ] PID tracking + trap cleanup on EXIT/INT/TERM                     │
│    [ ] Dead-agent detection (kill -0 in wait loops)                     │
│    [ ] Status file for monitoring                                       │
│    [ ] Handoff file contract documented                                 │
│    [ ] Delegation depth bounded                                         │
│    [ ] Worker prompts say "do not spawn another instance"               │
│    [ ] Static script invoked with config (NOT generated from template)  │
│    [ ] Script is shellcheck-clean and independently testable            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Report Template

Write the report directly as markdown — do not wrap it in a code fence.

```markdown
# Skill Evaluation Report: [Skill Name]

## Summary

- **Total Score**: X/130 (X%) [or X/120 if D9 N/A]
- **Grade**: [A/B/C/D/F]
- **Pattern**: [Mindset/Navigation/Philosophy/Process/Tool/Orchestrator]
- **Knowledge Ratio**: E:A:R = X:Y:Z
- **D9 Applicable**: yes/no
- **Verdict**: [One sentence assessment]

## Dimension Scores

| Dimension                         | Score | Max | Notes |
| --------------------------------- | ----- | --- | ----- |
| D1: Knowledge Delta               | X     | 20  |       |
| D2: Mindset + Procedures          | X     | 15  |       |
| D3: Anti-Pattern Quality          | X     | 15  |       |
| D4: Specification Compliance      | X     | 15  |       |
| D5: Progressive Disclosure        | X     | 15  |       |
| D6: Freedom Calibration           | X     | 15  |       |
| D7: Pattern Recognition           | X     | 10  |       |
| D8: Practical Usability           | X     | 15  |       |
| D9: Delegation & Process Lifecycle| X     | 10  | (or N/A) |

## Critical Issues

[Must-fix problems that significantly impact the Skill's effectiveness]

## Top 3 Improvements

1. [Highest impact improvement with specific guidance]
2. [Second priority improvement]
3. [Third priority improvement]

## Detailed Analysis

[For each dimension scoring below 80%:
- What's missing or problematic
- Specific examples from the Skill
- Concrete suggestions for improvement]
```

Include the Quick Reference checklist (above) at the end of the report. Copy the checklist
block verbatim — it already has its own ` ```text ` fence; do NOT wrap it in another code fence.

---

## Calibration Notes

Use these principles when scoring:

| Principle | Application |
| --------- | ----------- |
| Surface quality is misleading | LLMs produce polished output by default — don't let formatting inflate scores |
| Density > length | A 50-line skill with pure expert knowledge beats a 500-line skill with padding |
| Description is the activation gate | Great content with a bad description = never used = worthless |
| Orphan references = false confidence | References without triggers are worse than no references |
| Process lifecycle = production safety | Skills that spawn processes without cleanup are hazards |

## The Meta-Question

> **"Would an expert say: 'Yes, this captures knowledge that took me years to learn'?"**

If yes → genuine value. If no → it's compressing what the model already knows.
