---
name: arbe-discover-primitives
description: Distill an unfamiliar repo into at most 10 reusable primitives and a plain dependency graph — a mental model, not an inventory. Use when deciding whether a codebase can be wrapped, forked, or exposed as a library or MCP server. Describes what exists; arbe-diagram-first designs a new shape, arbe-improve-codebase changes one.
---

# Discover primitives

Use this when you want to walk away from a codebase with a mental model you can hold in your head and explain in a meeting — not a 9-section report.

The default failure mode of "list the primitives" is a giant inventory you skim once and forget. This prompt fights that with hard caps, one-line entries, and precise nouns — while still giving the model enough scaffolding to investigate properly.

## Prompt template

```text
Read this repo as if the app/UI were stripped away and only a reusable SDK/MCP-like surface remained.

Goal: a mental model I can hold in my head and share with someone who has to make a decision. Not an inventory.

A primitive is one of:
- a reusable contract or type
- a state/storage boundary
- a transport boundary
- a parser/normalizer/dispatcher boundary
- an auth/session capability

Ignore:
- UI flows, screens, pages, components (unless one reveals a primitive)
- product positioning and feature summaries
- generic app descriptions
- implementation trivia unless it defines a boundary

Process:
1. Inspect exported/shared modules first, before app code.
2. Identify the smallest meaningful operations those modules expose.
3. Group them into capability areas.
4. Note the shared types/schemas those primitives rely on.
5. Identify storage and transport boundaries.
6. Separate shared primitives from app/server/UI orchestration.
7. Call out what is not exposed.

Output (strict, in this order):
1. One sentence — what is the underlying machine this repo is, beneath the product?
2. Capability groups, each with 1–3 primitives as one-liners in the form
     `name (file/module) — exact capability — stateless | stateful | requires-setup — why it's primitive`
   Aim for 3–7 groups, OR a flat list if all primitives cohere into one area. Don't force groups that aren't there.
3. Dependency graph — plain `a → b` lines, one per dependency. No boxes, no ASCII art.
4. Not exposed — what's notably missing, or only available as app orchestration rather than a shared contract. Include cases where docs claim primitives the shared code doesn't actually expose.

Hard caps:
- ≤ 10 primitives total. If you have more, you haven't distilled — merge or drop the weakest.
- One line per primitive. No paragraphs, no bullet sub-lists.
- No "SDK framing" / "MCP framing" sections. The whole output is already that.

Rules:
- Prefer actual code over README claims.
- Be opinionated about naming. If the codebase uses several words for the same concept, pick the best one and list the rest as `aliases (avoid): x, y` so the mental model has one term per thing.
- Only project-specific primitives. Commodity plumbing (HTTP server, JSON parser, ORM, log writer) doesn't belong even if heavily used. Before listing a primitive, ask: is this concept distinctive to this codebase, or generic infrastructure? Only the former belongs.
- If a behavior only exists inside app orchestration and is not exposed as a shared contract, it is composition, not a primitive — surface it under "not exposed".
- Use precise technical nouns. Do not describe what the product is for.

Prefer phrasing like:
- "Token-bucket rate check"
- "JSON body → typed event parsing"
- "Signed URL minting"
- "Authenticated client construction"

Avoid phrasing like:
- "Rate limiting"
- "Event handling"
- "File access"
- "App features"

I am not interested in the app itself. I only want the primitives this repo contains if the app were stripped away. If you find yourself writing product copy or expanding into paragraphs, stop and cut.
```

## When this works best

- Spiking on a legacy or unfamiliar codebase you might embed, fork, wrap, or expose
- Deciding whether a repo can become an MCP server or a library
- Answering what the core building blocks are if the product shell were stripped away
- Briefing someone else on what's actually reusable, in a form that fits on one screen

## Optional loosening

If the strict version drops something load-bearing, append:

```text
Also include composite workflows that are directly exported as a reusable surface. Label them "composition" so they don't get confused with primitives.
```
