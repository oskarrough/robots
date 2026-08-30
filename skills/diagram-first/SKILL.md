---
name: arbe-diagram-first
description: "Draw a 5–10 line ASCII pipeline of the user verb, then stop and wait — no prose or code until the shape is agreed. Use for a single design or structure question: a pasted spec, a one-thing-or-two call, a how-should-this-be-shaped ask. Skip bug reports, UX complaints, and features whose verb is already pinned. Full session through to a plan: arbe-mull. Auditing a diagram that exists: arbe-pipeline-audit."
---

# Diagram-first

On an explicit design question: draw a 5–10 line ASCII pipeline of the user verb, then stop with a question or claim. No preamble, no architecture essay, no code until the user reacts.

Detailed specs often bake in the wrong shape because the author is too close to today's code. A verb-first tree is the quick check.

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

1. Pin the verb — if unclear, ask at most one or two short questions; otherwise skip.
2. Draw the diagram — tree shape (`└─`, `├─`), 5–10 lines. First line is what the user is trying to do, not a module or route name. If several surfaces share one backend flow, show one pipeline with branches — not parallel copies.
3. List nouns — one line under the diagram; flag duplicate names for the same thing, or names that sound like implementation instead of user intent.
4. Close with a claim or proposal — one short line that gives the user something to push against: a one-sentence claim about what's wrong with the current shape, or a concrete proposal for the next move ("I'd collapse X and Y into one verb — want me to sketch it?"). A bare "does this match?" is too passive; only fall back to it when you genuinely can't form a claim. Never end on the nouns line.
5. Stop — wait for reaction. If a long spec disagrees with the diagram, say so briefly and push back. Only then continue with prose or code.

## Anti-patterns

- Paragraphs before the diagram
- Parallel pipelines when surfaces share one backend verb
- Leading with nouns instead of the verb
- Skipping the pause — the stop is the point
- Ending on the nouns line with no question or claim
- Reaching for the skill on UX complaints or user frustration that wasn't a design ask
