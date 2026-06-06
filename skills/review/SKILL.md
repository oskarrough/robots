---
name: arbe-review
description: Two-mode code review — diff review after implementing a task, and sweep review across the codebase that creates follow-up tasks. Use after implementing a task or when sweeping the repo.
---

# How to review

Two modes: diff review after implementing a task, and sweep review across a codebase.

## Greenfield context

If the project is alpha software with no real users, backward compatibility is not a constraint. If you spot a naming or design that is clearly wrong or inconsistent with the architecture docs, say so directly. Don't hedge. Surface the tradeoff and offer a concrete suggestion. Bad names and bad boundaries compound quickly; fixing them early is cheap.

## Diff review

Run after completing a task, or when explicitly asked to review.

Pin the comparison point first — a commit, a branch, `main`, `HEAD~5`, or specified files. If unclear, ask. Capture the diff command once (`jj diff -r <point>..@`, `git diff <point>...HEAD`) and use it throughout.

For each changed file, read the full file for context — not just the diff lines.

Review two axes: spec and quality.

Spec: does the diff match the task, PR, or issue? Look for missing requirements, scope creep, and wrong implementation.

Quality: use the categories below. For large diffs, split independent areas across subagents so contexts don't pollute each other.

Skip what tooling already enforces: lint, typecheck, formatter.

Flag issues in these categories, ordered by importance:

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
- comments explaining what code does instead of why
- added documentation nobody asked for

### Data flow legibility

- can you describe the function as `stage → stage → stage`? if not, it's mixing concerns
- each stage should have a typed input and typed output — the types document the flow
- side effects should be identifiable stages, not interleaved with transforms
- a function that fetches, transforms, and writes in one block → split into stages, compose them
- two functions sharing a pipeline shape but differing in one stage → extract the pipeline, parameterize the differing stage
- the pipeline doesn't have to be literally `a |> b |> c` — it means each step is named, testable, and the composition is visible at the call site

### Naming and clarity

- abbreviated variable names → full words
- generic names (`data`, `handler`, `process`) → domain-specific verbs
- method names that don't express the concept directly

### Output

Be direct. For each issue:
- what: the specific thing
- why: which principle it violates, referencing the project's code-style doc when present
- fix: concrete suggestion, not vague advice

If nothing needs to change, say so. Don't invent issues.

Keep it conversational. This is a peer review, not a report.

## Sweep review

Breadth-first pass over all source files. Find only — no fixes, no suggestions. Create one task per finding group so other sessions do the work.

The separation matters: finding and fixing in the same pass loses breadth.

If you encounter a naming or design that clearly conflicts with the architecture docs, tasks, or canonical schema layer — and a better alternative is obvious — surface it as a separate design question before the task list. One paragraph: what's inconsistent, what the better design would be, why it matters. This is not a task; it's a signal for the human to decide before work begins.

### Categories

Check in this order.

Duplication: logic or structure repeated across files. Note file:line for each occurrence.

Anti-patterns: violations of the project's code-style doc, such as try/catch over early returns, type casts silencing errors, default exports, deep nesting, class soup in HTML/CSS, and silent error swallowing.

Dead code: exports with no importers, unreachable branches, commented-out blocks.

Structural issues: files doing more than one thing, functions mixing side effects with transforms, pipeline stages not separated.

Inconsistencies: same concept expressed differently across files, such as naming, patterns, or error handling style.

Type safety: untyped values flowing through the system, `any` casts, missing return types on exported functions.

Error handling gaps: errors discarded, recovery paths missing, UI errors without actionable messages.

Test bloat: mock-heavy unit tests, assertions on call shapes instead of contracts, large test files with low signal. Flag for deletion or rewrite as integration. See the project's testing or code-style docs when present.

### Output

One task per finding group. Description must include specific file paths and line numbers, which category or principle it violates, and no suggested fix.

Skip categories with nothing to flag. Don't invent issues.
