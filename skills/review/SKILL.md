---
name: arbe-review
description: "Two-mode code review: diff review after implementing a task, and a sweep across the codebase that files follow-up tasks. Use after finishing a change or when reviewing someone else's. Single diff or single file scale — arbe-pipeline-audit for a call path, arbe-improve-codebase for modules."
---

# Review

Two modes: **diff review** of one change, **sweep** over a codebase that files tasks for other sessions.

Both modes: the project's code-style and testing docs outrank this file when present, but flag a doc violation only when you can quote the rule and the line that breaks it. Skip what tooling already enforces (lint, typecheck, formatter). Don't invent issues; if nothing needs to change, say so. Alpha software with no real users has no backward-compatibility constraint, so a wrong name or boundary is a finding, stated plainly with a concrete alternative.

## Diff review

Pin the comparison point first: a commit, a branch, `main`, or specified files. If unclear, ask. Capture one diff command and reuse it: `jj diff --from <point> --stat` then per file, or `git diff <point>...HEAD`. For each changed file read the whole file, not just the hunks. Split a large diff across subagents by independent area so contexts don't pollute each other.

Three axes, in this order:

1. **Spec.** Does the diff do what the task, PR, or issue asked? Missing requirements, scope creep, wrong reading of the ask.
2. **Correctness.** Edge cases, error paths, ordering and concurrency, state left inconsistent on failure, changed behavior with no test covering it. Two procedures, always: for every deleted or replaced line, name the invariant it enforced and find where the new code re-establishes it; for every changed function, grep its callers for a broken precondition, return shape, or new exception. Verify before you flag: read the caller, run the check, reproduce the claim in the current tree. A finding you couldn't confirm is a question, not a finding.
3. **Quality.** The categories below, most important first.

### Categories

**Unnecessary complexity**
- abstraction with one call site → inline it
- helper for basic object creation → literal
- wrapper object around simple data → pass primitives
- method that only delegates → do meaningful work or don't exist
- getters/setters → direct property access
- builders, factories, config objects for straightforward things → delete the ceremony

**Wrong patterns**
- try/catch where validation + early return works
- type casts silencing real errors (`/** @type {any} */`, `as Type`)
- silent error swallowing → propagate or handle meaningfully
- default exports → named exports
- deep nesting → flatten
- class soup in HTML → semantic elements, data-* attributes, ARIA
- class soup in CSS → element selectors, `:has`, `:where`, `:is`

**Over-engineering**
- features beyond the ask, "future-proofing", configurability nobody requested
- comments explaining what instead of why; documentation nobody asked for
- a special case layered on shared infrastructure → the fix isn't deep enough; name the general change to the mechanism

**Data flow legibility**
- a function should read as `stage → stage → stage`, each with typed input and output; if it can't, it's mixing concerns
- side effects are named stages, not interleaved with transforms; fetch-transform-write in one block → split and compose
- two functions with the same pipeline shape differing in one stage → extract the pipeline, parameterize the stage
- literal `a |> b |> c` is not required; each step named and testable, composition visible at the call site, is

**Naming and clarity**
- abbreviations → full words; generic names (`data`, `handler`, `process`) → domain-specific verbs
- method names that don't say the concept

### Output

Peer review, not a report. Findings first, ordered by axis then importance. Each one names the file and line, the failure scenario (which input or state produces which wrong result) or for quality findings the concrete cost (what is duplicated, wasted, or harder to change), and the fix: concrete, not advice. Plain markdown, no tables, no narration of what you checked.

## Sweep

Breadth-first over all source files. Find only: no fixes, no suggestions. Finding and fixing in the same pass loses breadth.

If a name or design clearly conflicts with the architecture docs or canonical schema and a better alternative is obvious, surface it as one paragraph before the task list: what's inconsistent, what the better design is, why it matters. It's a decision for the human, not a task.

Check in this order:

- **Duplication:** logic or structure repeated across files; file:line for each occurrence
- **Anti-patterns:** the Wrong patterns list above, where no lint rule exists for it
- **Dead code:** exports with no importers, unreachable branches, commented-out blocks
- **Structural:** files doing more than one thing, side effects mixed with transforms, pipeline stages not separated
- **Inconsistencies:** one concept expressed differently across files (naming, patterns, error handling)
- **Type safety:** untyped values flowing through the system, `any` casts, missing return types on exports
- **Error handling gaps:** errors discarded, recovery paths missing, UI errors without an actionable message
- **Test bloat:** mock-heavy unit tests, assertions on call shapes instead of contracts, big low-signal files; flag for deletion or rewrite as integration

### Output

One task per finding group, in whatever tracker the project uses: file paths and line numbers, the category or principle violated, no suggested fix. Skip categories with nothing to flag.
