---
name: arbe-diagram-first
description: When the user explicitly asks for design, structure, or architecture work, draw a 5–10 line ASCII pipeline of the user verb and stop. Use when the user pastes a multi-paragraph spec, asks "one thing or two", or asks how to structure/shape something. Skip for bug reports, UX complaints, feature implementation of an already-pinned verb, and anything where the user hasn't asked for design work.
---

# Diagram-first

On an explicit design question: **draw a 5–10 line ASCII pipeline of the user verb, then stop with a question or claim.** No preamble, no architecture essay, no code until the user reacts.

Detailed specs often bake in the wrong shape because the author is too close to today's code. A verb-first tree is the quick check. Use this without being asked when a long prescriptive spec lands — don't wait for the user to reframe it.

## When to use

- User pastes a multi-paragraph spec, goal, or design doc
- User explicitly asks about structure, architecture, or "one thing or two"
- Refactor where the user has asked you to rethink the shape

## When to skip

- User reports confusion, fatigue, or "I don't get it" — ask what they want before diagramming
- Bug fixes, feature implementation where the verb is already pinned
- Follow-up tweaks to an existing design
- Tiny code changes, single-file bugfixes

## What to do

1. **Pin the verb** — if unclear, ask at most one or two short questions; otherwise skip.
2. **Draw the diagram** — tree shape (`└─`, `├─`), 5–10 lines. First line is what the user is trying to do, not a module or route name. If several surfaces share one backend flow, show one pipeline with branches — not parallel copies.
3. **List nouns** — one line under the diagram; flag duplicate names for the same thing, or names that sound like implementation instead of user intent.
4. **Close with a question or claim** — one short line: either "does this match what you're after?" or a one-sentence claim about what's wrong with the current shape. Never end on the nouns line — that leaves the user with nothing to react to.
5. **Stop** — wait for reaction. If a long spec disagrees with the diagram, say so briefly and push back. Only then continue with prose or code.

## Anti-patterns

- Paragraphs before the diagram
- Parallel pipelines when surfaces share one backend verb
- Leading with nouns instead of the verb
- Skipping the pause — the stop is the point
- Ending on the nouns line with no question or claim
- Reaching for the skill on UX complaints or user frustration that wasn't a design ask
