---
name: arbe-documentation
description: Diátaxis-style four-mode docs (tutorial, how-to, reference, explanation) — keep them separate, lead with the point, link to code. Use when authoring or restructuring user-facing documentation.
---

# Documentation

Documentation has four modes. Keep them separate. A tutorial that explains too much drags. A reference that argues becomes useless.

- tutorial — learning by doing. Show the destination first. One path. Visible progress. Minimal explanation. It must work every time.
- how-to — solve a problem. Title it from the reader's point of view. Assume competence. Link to explanation for theory.
- reference — describe what exists. Mirror the thing it describes. No rationale unless accuracy needs it.
- explanation — build understanding. Connect concepts, history, and tradeoffs. Opinion is fine.

Before writing, ask what the reader needs right now. Write only that. Link to the other modes.

Each doc serves one reader — someone developing on arbe, someone building on its APIs, or someone using the web app. Infer which from the doc's content and place; don't write a banner saying so. Write only what that reader needs and cut what they don't. If you're serving two readers in one doc, it's two docs.

Docs describe what the system is and why; tasks carry what we're about to do. When code and doc disagree, fix the code or update the doc — don't silently drift the doc to match reality.

## Altitude

A doc is a map to the code, not a transcript of it. Lead with how the pieces wire together and why; let the agent open the file for the rest. The test for any line: would you have to edit it in lockstep with a code change? If yes, the code already owns it — name the code path and link, don't copy. Copies drift; the original never lies.

Include:
- the wiring — what the pieces are and how they connect
- the why — design contracts, boundaries, the reason a seam exists
- the names of the code paths that own the detail

Leave to the code:
- function and type signatures, `interface` blocks, column and field lists
- CLI flags, alias lists, `--help` output
- per-file or per-function maps, and flowcharts that mirror one function's control flow
- constants and thresholds that live in the source

A reference doc legitimately mirrors a stable contract, such as an HTTP API or wire format. Everything else is a map.

## Design docs

When a concept needs shared reference across multiple tasks, write a design doc instead of duplicating context. One concept per doc. Start with what it is, then how it behaves, then scope. Include concrete examples and error cases. Implementable without clarification.

Useful skeleton:

```markdown
# Feature name

> one-line summary

## Problem
what breaks or is missing, and why it matters (2-3 sentences)

## Requirements
- what must be true when this is done
- state constraints, not steps

## Invariants
- properties that must hold regardless of implementation
- how you'd know something is wrong: observable behavior, contract violations

## Not doing
- traps, exclusions, explicit non-goals
```

## Process

1. Read the current doc.
2. Read the code it covers.
3. Update only what changed or is missing.
4. Remove stale claims.
5. Keep the structure unless it misleads.
6. If a section is already clear and correct, leave it alone.
7. When adding, renaming, or removing a file under `docs/`, update any hand-maintained sidebar or index so it stays in sync.

## Style

Front-load the point. Assume the reader may leave after the first paragraph.

Be terse. Cut repetition. Link instead of restating.

No marketing headings. No padding. Use bullets only when they clarify.

No `**bold**` ornament — no `**term**: gloss` lists, no bold mini-titles. Write prose, or lead with a plain label.

ASCII diagrams are good.

## Cuts

Spot the trigger, apply the fix. Examples are real shapes, not parody.

Migration narration. Triggers: "retired with…", "the previous X was…", "we used to have…", "X is gone". Fix: delete. Describe the current shape only. History lives in commits.

Task IDs in prose. Trigger: any task ID outside a task file. Fix: delete the parenthetical, or replace with a concept link. IDs belong in tasks.

Self-defending paragraph. Trigger: a noun's definition followed by why-it's-good. Fix: keep the definition, drop the defence. If you can't drop it without losing meaning, the design isn't settled — say "open" instead.

Same claim, three sentences. Trigger: a paragraph where each sentence introduces a fresh metaphor for one fact. Fix: keep the strongest sentence, delete the others.

Wrong-page duplication. Trigger: a section re-explains a concept another doc owns (storage, permissions, secrets). Fix: cut to a one-line pointer and link the owner — don't re-explain. Two docs explaining one mechanism drift apart.

Justifying subordinate clause. Trigger: "To keep X on the fast path, we…", "So that Y stays Z, …". Fix: drop the clause. State the rule.

Aphorism without contrast. Trigger: "X is A, not B" where B no longer exists in the codebase. Fix: delete. It only worked while B was live.

Status preamble that's now stale. Trigger: "> Status. … is in progress / landing soon / task closes when …". Fix: delete if landed; otherwise rewrite as one line of present-tense scope.

Compressed sentence. Trigger: one sentence introduces and defines three or more unfamiliar nouns at once, usually via apposition or stacked clauses. Reader has to hold every term simultaneously to parse the verb. Fix: one new term per sentence. Name it, then say what it does. Whitespace between concepts.
