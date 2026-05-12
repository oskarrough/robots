---
name: arbe-diagram-first
description: Before any prose or code on a design question, draw a 5–10 line ASCII pipeline diagram of the user verb and stop. Use when the user pastes a spec/goal/design, when a design question shows up mid-chat, on refactors where the existing shape feels muddled, or any "should this be one thing or two" question. Skip for tiny code changes with no design content.
---

# Diagram-first

On a design question: **draw a 5–10 line ASCII pipeline of the user verb, then stop.** No preamble, no architecture essay, no code until the user reacts.

Detailed specs often bake in the wrong shape because the author is too close to today's code. A verb-first tree is the quick check. Use this without being asked when a long prescriptive spec lands — don't wait for the user to reframe it.

## When to use

- User pastes a spec, goal, or design
- Mid-chat design question or "should this be one or two?"
- Refactor where the existing shape feels muddled

## When to skip

- Tiny code change with no design content
- Obvious single-file bugfix

## What to do

1. **Pin the verb** — if unclear, ask at most one or two short questions; otherwise skip.
2. **Draw the diagram** — tree shape (`└─`, `├─`), 5–10 lines. First line is what the user is trying to do, not a module or route name. If several surfaces share one backend flow, show one pipeline with branches — not parallel copies.
3. **List nouns** — one line under the diagram; flag duplicate names for the same thing, or names that sound like implementation instead of user intent.
4. **Stop** — wait for reaction. If a long spec disagrees with the diagram, say so briefly and push back. Only then continue with prose or code.

## Anti-patterns

- Paragraphs before the diagram
- Parallel pipelines when surfaces share one backend verb
- Leading with nouns instead of the verb
- Skipping the pause — the stop is the point
