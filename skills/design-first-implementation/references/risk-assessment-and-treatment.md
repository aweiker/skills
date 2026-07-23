# Risk Assessment, Treatment, and User Decision Gates

Load this reference when an unhappy path or transition could violate an important invariant, or when work touches security/privacy, persistence, migrations, financial effects, authorization, irreversible external actions, or material operational risk. Use the compact/full risk records and high-risk decision templates in this file's `Risk record templates` section.

## Purpose

Risk assessment prioritizes prevention, detection, recovery, and tests. It never permits unspecified behavior, excuses an invariant from coverage, or replaces evidence with intuition.

Use the compact record only for low/medium risk with high confidence and undisputed materiality/reachability. Use the full record for high, critical, or unknown risk; sensitive or irreversible effects; disputed materiality/reachability/recovery; or temporary mitigation.

## Dimensions

Keep these separate:

- **Impact:** direct consequence if mishandled—low, medium, high, or critical.
- **Exposure:** evidence-backed trigger likelihood—rare, plausible, or common.
- **Detectability:** immediate, delayed, or unlikely without a new signal.
- **Recovery:** automatic, manual, difficult, or irreversible.
- **Confidence:** high, medium, or low from inspected source/code/contract/runtime evidence.
- **Inherent risk:** risk before treatment.
- **Treatment:** remove/avoid, prevent, contain, detect, recover, transfer, or accept.
- **Residual risk:** risk remaining after treatment.
- **Verification evidence:** assurance that the production treatment works; it is not the treatment itself.

Low confidence in a material dimension makes inherent risk `unknown` until resolved. Missing evidence is never evidence of low risk.

## Require a reachable chain

Before rating, identify:

```text
reachable trigger -> incorrect behavior/transition -> violated invariant -> direct consequence
```

Do not extend the chain through unsupported unrelated failures. Record missing links as assumptions or blocking questions. Do not assign high/critical severity from a worst-imaginable story without this chain, and do not lower severity because remediation is inconvenient, code is internal, or current tests pass.

## Calibrate impact and inherent risk

Rate direct impact from consequence magnitude, material scope, sensitivity, and reversibility—not category labels. Rate exposure separately from reachability/frequency evidence. Derive inherent risk from:

| Impact \\ Exposure | Rare | Plausible | Common |
|---|---|---|---|
| Low | Low | Low | Medium |
| Medium | Low | Medium | High |
| High | Medium | High | High |
| Critical | High | Critical | Critical |

Detectability and recovery inform treatment urgency and residual risk; they do not rewrite direct impact or unmitigated exposure.

Impact definitions:

- **Critical:** direct consequence is demonstrably material and broad, causes material harm to sensitive assets, or is irrecoverable.
- **High:** materially harmful but bounded in scope or substantially reversible, though restoration may be difficult/incomplete.
- **Medium:** real but bounded, nonsensitive, and practically reversible without material security, privacy, financial, regulatory, or availability harm.
- **Low:** limited magnitude/scope, no sensitive asset or important invariant affected, and fully reversible with negligible loss. Detection quality is separate.

Authorization bypass, sensitive-data exposure, production data loss, financial transactions, regulatory effects, and outages are examples only when inspected evidence establishes material consequence. Category membership alone never sets severity. If materiality or reachability is unresolved, use `unknown`.

For each high/critical item, state what evidence would lower the rating. For each low item, state which assumption, if false, would raise it. If everything is high/critical, verify each record has a distinct invariant and direct consequence. If nothing is high in sensitive work, explain why.

## Removal versus mitigation

- **Removal/avoidance** changes the design so a trigger, hazardous behavior, or consequence is impossible within the stated authoritative boundary. Name the eliminated causal link, prove every relevant path crosses the boundary, identify remaining assumptions, and assess replacement risks.
- **Mitigation** leaves the hazard reachable but reduces likelihood, impact/blast radius, detection time, duration, or recovery difficulty. State the changed dimension and residual risk.
- Tests are assurance, monitoring is detection, and rollback is recovery. None alone removes risk.
- If safety depends on a component behaving, an operator responding, monitoring firing, a retry succeeding, or a test continuing to pass, the treatment is mitigation.

Treatment preference order:

1. Remove or avoid the hazardous capability/path.
2. Prevent failure at the authoritative boundary.
3. Contain impact or blast radius.
4. Detect reliably and quickly.
5. Recover or reconcile safely.
6. Transfer or explicitly accept the remainder.

Decision gates:

1. Is the hazardous capability necessary? If not, remove it. If unclear, ask rather than assuming it must remain.
2. Can the chain be broken at an authoritative boundary without removing required behavior? Prefer removal/prevention and prove the boundary.
3. Would removal violate a requirement, exceed authority, or create equal/greater replacement risk? Name the requirement/constraint/risk. Cost and schedule alone are insufficient.
4. Is mitigation enforceable and failure-path tested? When control failure could leave material residual risk, require independent detection and practical recovery or incident response.
5. Is residual risk explicitly acceptable to an owner authorized for that risk domain?

| Inherent risk | Expected treatment |
|---|---|
| Critical | Remove, or document why removal creates greater replacement risk, destroys required behavior, or is outside authority. Layered mitigation and acceptance by an authorized owner are mandatory if critical residual risk remains. |
| High | Prefer removal. Mitigation requires evidence that removal is inappropriate, tested preventive/detective/recovery controls, and explicit residual-risk treatment. |
| Medium | Prefer proportionate low-complexity removal; otherwise tested mitigation with documented residual risk. |
| Low | Use the simplest treatment preserving invariants without greater replacement risk. |

Removal is strongly preferred when capability is unnecessary, harm is irreversible or difficult to detect before occurrence, a sensitive boundary is crossed, controls depend primarily on operator response, prior mitigations failed, or residual risk remains high/critical.

Mitigation is reasonable when capability is essential, authority lies externally, an authoritative control materially changes risk, removal creates equal/greater risk, and residual risk is bounded and accepted.

Temporary mitigation requires a dedicated infeasibility rationale, authorized owner, expiration/review condition, monitoring for control failure, and tracked permanent-treatment path. Otherwise treat it as permanent acceptance requiring the same authority.

## Required controls and validation

- High/critical: explicit behavior, negative/failure-path test, detection/observability, and recovery/rollback validation when possible.
- Genuinely irreversible harm: explicitly record irreversibility and require stronger prevention, containment, and incident-response validation instead of inventing rollback.
- Medium: explicit behavior and test.
- Low: documented handling/validation when it touches an invariant or acceptance criterion.

Treat inherent and residual risk separately. Proposed controls and passing tests cannot rewrite inherent risk.

## High-risk user feedback

For every high/critical risk and potentially-high unknown, provide feedback **before implementation or the hazardous action**. If discovered mid-work, pause before further affected mutation.

Include:

- risk ID and evidence-backed chain;
- violated invariant and concrete consequence;
- severity/confidence and evidence that could change it;
- removal and mitigation options, including replacement risks/trade-offs;
- recommendation and rationale;
- safe/reversible action already taken, if any;
- residual risk, detection/recovery or irreversibility plan;
- authorized acceptance owner and specific decision required.

Do not silently accept risk or merely mention its rating.

Proceed without another question only when treatment is safe, reversible, already authorized by task/standing policy, does not alter required behavior, and does not accept material residual risk.

Ask with a recommendation when evidence is insufficient; options affect requirements, compatibility, cost, delivery, availability, or operational burden; removal may weaken required behavior; residual risk remains high/critical; an action is irreversible/externally visible; or ownership/authority/risk tolerance is unknown.

Use the **High-risk user feedback / decision** template in this file's `Risk record templates` section for the design record and user-facing decision. Do not emit a reduced or alternate schema. Complete every applicable field—including residual risk, acceptance authority, irreversibility/recovery, containment authorization, and restoration/read-back evidence—before proceeding.

Never ask a vague “what should I do?” If clarification is unavailable and irreversible harm is possible, make no new mutation or external dispatch, preserve evidence, and block the hazardous action.

## Strict bounds on unilateral containment

Without asking, containment is limited to:

- preserving evidence;
- making no new mutation or external dispatch;
- maintaining or entering a documented default-deny/safe state already authorized by policy or an exact runbook.

Do not delete data, rotate credentials, revoke access, disable shared services, alter availability, discard queued work, or perform public/external actions without explicit authorization or an exact runbook. Any permitted mutation requires a rollback/restoration handle and immediate read-back verification. If safety, authorization, or current safe state is uncertain, stop and ask.

## Risk implementation gate

Before implementation, verify:

- each rating cites evidence, a reachable trigger, violated invariant, and direct consequence;
- low ratings have affirmative materiality/reachability/detection/recovery evidence;
- unknowns affecting invariants are resolved or blocking;
- inherent and residual risk are separate;
- every treatment is classified;
- removal proves the eliminated causal link and replacement-risk assessment;
- mitigation names changed dimensions and residual risk;
- high/critical controls use tests, detection, and recovery/rollback or explicit irreversibility alternatives;
- high/potentially-high risk was communicated before action using the complete canonical record in `Risk record templates`, with no reduced alternate form;
- material acceptance has an authorized owner;
- any unilateral containment was exactly authorized, minimally mutating, restorable, and read back;
- temporary mitigation has rationale, owner, expiry/review, monitoring, and permanent path.

## Common pitfalls

1. Downgrading with “unlikely,” “internal,” or “tests cover it.”
2. Inflating through unsupported catastrophic chains or category labels.
3. Treating missing evidence as low rather than `unknown`.
4. Letting controls erase inherent risk.
5. Duplicating symptoms of one violated invariant into many risks.
6. Calling prevention, containment, detection, recovery, or tests “removal.”
7. Choosing mitigation because it is cheaper without a requirement, authority constraint, or replacement risk.
8. Removing required behavior under the label of risk removal.
9. Guessing user risk tolerance or acceptance authority.
10. Treating containment as broad mutation authority.

## Risk record templates

Use the compact record only for low/medium risks with high confidence and undisputed materiality/reachability:

```text
Risk ID:
Evidence sources:
Edge case / transition:
Violated invariant and direct consequence:
Impact / exposure / inherent risk:
Detectability / recovery evidence:
Confidence / assumptions:
Treatment type and mechanism:
Acceptance authority / standing policy, if treatment is acceptance:
Verification evidence:
Residual risk:
```

Use the full record for high/critical/unknown risks, sensitive or disputed cases, irreversible effects, and temporary mitigations:

```text
Risk ID:
Evidence sources:
Reachable trigger and evidence:
Incorrect behavior / transition:
Violated invariant and direct consequence:
Impact / material scope / reversibility:
Exposure:
Detectability:
Recovery or explicit irreversibility:
Confidence and evidence gaps:
Inherent risk:
Removal option / authoritative boundary / replacement risks:
Mitigation controls / dimensions changed:
Treatment selected and authorized owner:
Verification evidence:
Residual risk:
Unknowns and blocking status:
Temporary mitigation infeasibility rationale:
Temporary mitigation owner / review date / monitoring / permanent-treatment path:
User decision required:
```

For each high/critical item: what evidence would lower the rating?
For each low item: what assumption, if false, would raise it?
Unknowns that could affect an invariant: resolved, or why implementation is blocked.
Removal claim: eliminated causal link, authoritative boundary/evidence, and replacement risks.
Mitigation: risk dimension reduced, rationale, and remaining residual risk.

### High-risk user feedback / decision

Complete and present before implementation or the hazardous action for every high/critical risk and potentially-high unknown. If discovered mid-work, pause before further affected mutation:

- Risk ID, failure chain, violated invariant, consequence, and confidence:
- Evidence that would lower or resolve the risk:
- Removal option considered, trade-offs, and replacement risks:
- Mitigation option considered, dimension reduced, and residual risk:
- Recommendation and rationale:
- Recovery/rollback plan, or explicit irreversibility plus prevention/containment/incident response:
- Authorized residual-risk acceptance owner:
- Containment already applied, or none:
- Containment authorization/task/policy/runbook:
- Rollback/restoration handle and read-back verification:
- User decision required, or why existing authorization is sufficient:

If unsure, ask the user inline with concrete options and a recommendation; do not assume the user's requirements, authority, or risk tolerance. If no answer is available and irreversible harm is possible, make no new mutation or external dispatch, preserve evidence, and block the hazardous action. Enter another default-deny state only when an existing policy/runbook authorizes that exact transition.
