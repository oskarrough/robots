# Stage 3 — research

Compress current truth: how the codebase works today in the areas the questions point at. Which files matter, what patterns exist, how similar things are tested.

**Reads:** `02-research-questions.md` — and the codebase.
**Writes:** `03-research.md`.

## Ticket isolation

You do not read the raw request or `01-clarified-request.md`. You are not told what is being built.

This is deliberate. The moment research knows the goal, it starts writing the solution into its findings, and the one honest account of the codebase is gone. Research and intent meet for the first time in stage 4.

If you are running in a single context and already know the goal, you cannot unsee it — so hold the line explicitly: write only what you verified in the code, and cut any finding you would not have written if you didn't know the goal.

## Do

1. Read the research questions.
2. Investigate the codebase. If you can spawn subagents, fan out 2–6 in parallel **grouped by area of the codebase, not one per question** — one question often spans three files and one file often answers three questions. Synthesize their findings yourself.
3. Verify everything you write. Every claim gets a `file:line` citation or it doesn't go in.
4. If a question can only be answered by the human (product history, external system, undocumented intent), ask for that one specific thing and wait. One at a time.
5. Write the research doc — a technical explainer, concept first, evidence attached:

```markdown
# Research

## Goal
- What this research was trying to understand.

## Summary
- How the current system works in the relevant area. Concept first, then the mechanics.

## Findings
- Question-by-question answers, each with `file:line` evidence.

## Relevant Parts
- Files, services, modules, endpoints, tables, or subsystems involved, with paths.

## Patterns
- How the codebase already does similar things, with an example reference each.

## Testing
- How this area is tested today, per component, with paths. If it isn't tested, say so plainly — that is a finding, not an omission.

## Constraints
- Current limits, dependencies, contracts, invariants.

## Unknowns
- What could not be confirmed, and what would confirm it.
```

## Rules

- **Document what exists. Never propose.** No improvements, no critique, no "this should be refactored", no implementation section. If you find something ugly, describe it neutrally and move on.
- Never fabricate a path, symbol, or behaviour. Unverified goes under Unknowns.
- Keep facts and inference separate, and label inference as inference.
- Open questions stay investigative ("how does X reach Y?"), never normative ("should Z be reworked?").
- Concept before code. A wall of citations with no explanation is not research.
- Accept the user's preferences at face value; verify their claims about the code.
- On user feedback, update in place. Do not start over.

## Done when

Stage 4 can discuss design without rediscovering the system, and every claim in this doc can be traced to a line of code.
