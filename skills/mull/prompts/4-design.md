# Stage 4 — design discussion

The most important stage. Intent meets codebase truth for the first time. Make the architecture calls, choose which existing patterns to follow, state the non-goals.

**Reads:** `01-clarified-request.md` + `03-research.md`.
**Writes:** `04-design.md`.

This is the durable rewind point. If the build later goes wrong because the shape is wrong, you come back here — so everything that matters goes in this document.

## Do

Work one decision at a time. Never dump the full decision list.

**While decisions are open:**

1. Pick the single most important unresolved one.
2. Frame the choice in one sentence.
3. Give the options, 1–2 lines each with the tradeoff inline. Ground each one in the research — name the pattern or file it follows or breaks.
4. State your recommendation and why, in one sentence.
5. Ask the user which way to go. Stop.

**Recommend, don't resolve.** Every design question stays open until the human answers it. A clear call from them ("for X, do Y") closes it — record it as resolved with the rationale and what was discarded.

**When all decisions are settled**, write the design doc:

```markdown
# Design Discussion

## Current State
- How it works today, in one short paragraph. Sourced from research.

## Desired End State
- How it should work once this is done, and how you'd tell from the outside.

## What We Are Not Doing
- Explicit non-goals. Be specific — this section prevents scope drift downstream.

## Shape
- Before/after sketch. ASCII diagram or a few lines of pseudocode. Show the change, not the whole system.

## Resolved Decisions
- **[name]** — chose [option]. Why: [one line]. Discarded: [option] because [one line].

## Patterns To Follow
- The existing patterns this work should follow, with references. Prune the ones that turned out stale.

## Risks and Tradeoffs
- Only the ones that affect how the work gets sequenced or scoped.

## Open Questions
- Aim for zero. Anything left here blocks stage 5.
```

## Rules

- One decision per turn. No walls of pros and cons.
- Recommendations grounded in the research, not in general good practice.
- Surface your recommendation — don't hide behind neutrality.
- Record what was discarded and why. Six weeks later that's the valuable part.
- No task breakdowns, no phases, no implementation steps. That's stages 5 and 6.
- If a decision turns out to need evidence the research doesn't have, say so and go back rather than guessing.
- On user feedback, update decisions in place. Do not restart.

## Done when

Every decision is resolved by the human, the non-goals are explicit, and stage 5 can phase the work without inventing a missing choice.
