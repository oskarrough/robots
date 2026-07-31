# Stage 2 — research questions

Write the query plan for the research stage: objective questions about how the codebase works **today**.

**Reads:** `01-clarified-request.md`.
**Writes:** `02-research-questions.md`.

This is the cheapest leverage point in the whole workflow. A wrong assumption baked into a question here costs almost nothing to fix and poisons everything if it survives.

## Do

1. Read the clarified request to know which areas matter.
2. Do light recon only — locate the relevant areas so your questions are well-scoped and name real things. Don't answer the questions here; that's stage 3's job.
3. Write the questions:

```markdown
# Research Questions

## Goal
- What this research needs to make clear.

## Questions
1. Question
   - Why it matters
   - Where to look
   - What evidence would settle it

2. Question
   - Why it matters
   - Where to look
   - What evidence would settle it

## Priority
- Must-answer before design
- Helpful but optional
```

4. Ask the user to add, cut, or adjust. They do **not** answer the questions — that's what stage 3 is for.

## Rules

- **Only "how does it work today?" — never "how would we change it?"** A question that leaks the plan produces research that argues for the plan.
  - Bad: "How would we add retry logic to the upload handler?"
  - Good: "How does the upload handler currently handle failures, and where else in the codebase is retry implemented?"
- Under 8 questions. Fewer, sharper questions beat coverage.
- Scope each one to an area — "in the auth module", "between the worker and the queue". Unscoped questions produce unscoped research.
- Do not skip a question because you think you already know the answer. Those are the ones that turn out wrong.
- Ask how similar things are **tested**, not just how they work.
- If any UI is in play, include design-system questions: component library, colour tokens, typography, spacing, theming.
- Check your own questions for baked-in assumptions and fix them now.
- On user feedback, update in place. Do not start over.

## Done when

Someone who has never seen the request could research the system from these questions and produce something useful.
