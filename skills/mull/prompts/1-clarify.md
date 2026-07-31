# Stage 1 — clarify intent

Turn a vague request into a clear one. Purpose, outcome, constraints, unknowns. Not implementation.

**Reads:** the raw request and any clarifications the user has given.
**Writes:** `01-clarified-request.md`.

## Do

1. Re-read the raw request. Note what is actually specified versus what you are inclined to assume.
2. If something load-bearing is unclear, ask 1–2 high-value questions and stop. Interview-like, not a checklist.
3. Otherwise write the clarified request. Use this shape as a guide — skip empty sections, one line per bullet, write for a colleague not a committee:

```markdown
# Clarified Request

## Summary
- Short plain-language summary of the request.

## Problem
- What is missing, broken, or frustrating today.

## Who It Is For
- The main user, stakeholder, or audience.

## Desired Outcome
- What should be true when this succeeds.

## Success Criteria
- How we would know it worked.

## Constraints
- Fixed limits, requirements, or realities.

## Non-Goals
- What is explicitly not part of this.

## Assumptions
- Things we believe but have not confirmed.

## Open Questions
- Important things still unanswered.
```

## Rules

- **WHAT and WHY, never HOW.** No architecture, file paths, API names, library choices, or implementation sketches. If you catch yourself naming a mechanism, you have drifted into stage 4.
- Ask about purpose before mechanics.
- Do not silently fill gaps. Surface an assumption or ask.
- Keep it tight. Every later stage reads this; padding costs context downstream.
- On user feedback, update this output in place. Do not restart.

## Done when

Stage 2 can tell what matters about this request and what still needs to be learned about the codebase.
