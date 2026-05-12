---
name: arbe-review
description: Two-mode code review — diff review after implementing a task, and sweep review across the codebase that creates follow-up tasks. Use after implementing a task or when sweeping the repo.
---

# How to review

two modes: diff review (after implementing a task) and sweep review (codebase-wide, creates tasks).

## Greenfield context

if the project is alpha software with no real users, backward compatibility is not a constraint — if you spot a naming or design that is clearly wrong or inconsistent with the architecture docs, say so directly. don't hedge. "we could rename X to Y" is fine to say. surface it, discuss the tradeoff, and offer a concrete suggestion. the cost of a bad name or bad boundary compounds quickly; fixing it now is free.

## Diff review

run after completing a task, or when explicitly asked to review.

pin the comparison point first — a commit, a branch, `main`, `HEAD~5`, or specified files. if unclear, ask. capture the diff command once (`jj diff -r <point>..@`, `git diff <point>...HEAD`) and use it throughout.

for each changed file, read the full file for context — not just the diff lines.

two axes: **spec** (does the diff match the task/PR/issue — missing requirements, scope creep, wrong implementation) and **quality** (categories below). for large diffs, run them as parallel sub-agents so contexts don't pollute each other.

skip what tooling already enforces (lint, typecheck, formatter).

flag issues in these categories, ordered by importance:

### Unnecessary complexity
- abstractions that serve one call site → inline them
- helper functions for basic object creation → use literals directly
- wrapper objects around simple data → pass primitives
- methods that just delegate → should do meaningful work or not exist
- getters/setters → direct property access
- builders, factories, config objects for straightforward things → delete the ceremony

### Wrong patterns
- try/catch where validation + early return works
- type casts silencing real errors (`/** @type {any} */`, `as Type`)
- silent error swallowing → let errors propagate or handle meaningfully
- default exports → named exports
- deep nesting → flatten
- class soup in HTML → semantic elements, data-* attributes, ARIA
- class soup in CSS → element selectors, modern selectors (`:has`, `:where`, `:is`)

### Over-engineering
- features beyond what was asked
- "future-proofing" abstractions
- extra configurability nobody requested
- comments explaining what code does (instead of why)
- added documentation nobody asked for

### Data flow legibility
- can you describe the function as `stage → stage → stage`? if not, it's mixing concerns
- each stage should have a typed input and typed output — the types document the flow
- side effects (DB writes, API calls, state mutations) should be identifiable stages, not interleaved with transforms
- a function that fetches, transforms, and writes in one block → split into stages, compose them
- two functions sharing a pipeline shape but differing in one stage → extract the pipeline, parameterize the differing stage
- the pipeline doesn't have to be literally `a |> b |> c` — it means each step is named, testable, and the composition is visible at the call site

### Naming and clarity
- abbreviated variable names → full words
- generic names (`data`, `handler`, `process`) → domain-specific verbs
- method names that don't express the concept directly

### Output

be direct. for each issue:
- what: the specific thing
- why: which principle it violates (reference the project's code-style doc when present)
- fix: concrete suggestion, not vague advice

if nothing to flag, say so. don't invent issues.

keep it conversational. this is a peer review, not a report.

## Sweep review

breadth-first pass over all source files. find only — no fixes, no suggestions. create one task per finding group so other sessions do the work.

the separation matters: finding and fixing in the same pass loses breadth.

if you encounter a naming or design that clearly conflicts with the architecture docs, tasks, or the canonical schema layer — and a better alternative is obvious — surface it as a separate "design question" note before the task list. one paragraph: what's inconsistent, what the better design would be, why it matters. this is not a task; it's a signal for the human to decide before work begins. greenfield software → wrong names and wrong boundaries are worth naming.

### Categories (check in this order)

**duplication** — logic or structure repeated across files. note file:line for each occurrence.

**anti-patterns** — violations of the project's code-style: try/catch over early returns, type casts silencing errors, default exports, deep nesting, class soup in HTML/CSS, silent error swallowing.

**dead code** — exports with no importers, unreachable branches, commented-out blocks.

**structural issues** — files doing more than one thing, functions mixing side effects with transforms, pipeline stages not separated.

**inconsistencies** — same concept expressed differently across files (naming, patterns, error handling style).

**type safety** — untyped values flowing through the system, `any` casts, missing return types on exported functions.

**error handling gaps** — errors discarded, recovery paths missing, UI errors without actionable messages.

**test bloat** — mock-heavy unit tests, assertions on call shapes instead of contracts, large test files with low signal. flag for deletion or rewrite as integration.

### Output

one task per finding group. description must include specific file paths and line numbers, which category/principle it violates, and no suggested fix.

skip categories with nothing to flag. don't invent issues.
