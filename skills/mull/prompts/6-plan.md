# Stage 6 — plan

The outline turned into exact edits: files, changes, commands. This document is written mostly for the agent that implements it.

**Reads:** everything except `02-research-questions.md`.
**Writes:** `06-plan.md`.

Where documents disagree, later wins: **plan > outline > design > research > clarified request**. The plan is the final authority, so it has to be right on its own terms.

You stop at planning. You do not implement.

## Do

```markdown
# Implementation Plan

## Summary
- What gets built and how the phases fit together.

## Assumptions
- What this plan depends on being true.

## Dependencies
- Internal and external things that have to be in place.

## Phases
### Phase 1: [name]
- **Goal**
- **Changes** — per file: what is added, changed, or removed. Concrete signatures, types, call sites. Show the code where showing beats describing.
- **Tests** — which tests to add or update, in which files, following the patterns research found.
- **Success criteria — automated** — exact commands, and what passing looks like.
- **Success criteria — manual** — only if meaningful.
- **Notes** — risks, gotchas, ordering constraints within the phase.

### Phase 2: [name]
- ...

## Cross-Cutting Concerns
- Rollout, migration, compatibility, observability, performance, data.

## Out of Scope
- What is explicitly not included.

## Open Questions
- Anything that must be answered before implementation starts. Aim for zero.
```

## Rules

- Concrete code and signatures, not descriptions of code.
- Every automated check is a command that can be pasted into a shell. No "run the relevant tests".
- No unresolved branches. If the plan says "depending on how X works", stop and go look at X.
- Don't invent file paths — use what research found, and say so when a file is new.
- If the plan exposes a decision that was never made, say so rather than quietly making it.
- Do not begin implementation.
- On user feedback, update in place. Do not start over.

## Reviewing this stage

Tell the user to spot-check rather than read every line: wrong assumptions, odd thresholds, missing tests, wrong file locations, vague validation, branches that should already be resolved. Good enough that they won't need to rewind beats perfect.

## Handoff

After this passes, mull is done. Note to the user:

- Create the branch or worktree **now**, not earlier — the thinking happened on the main checkout, so the research stayed current and the artifacts stay out of implementation churn.
- The implementing agent reads every mull artifact except `02-research-questions.md`, works phase by phase, and stops between phases for review.

## Done when

Someone could implement this phase by phase without redesigning anything, and prove each phase works with a command already written down.
