---
name: arbe-mull
description: Run a six-stage design session — clarify → questions → research → design → outline → plan — with a review gate between each. Use for an idea or spec that needs serious thinking before any code. Stops at the plan. For one shape question, arbe-diagram-first is faster.
---

# Mull

Six stages, one at a time, with a review gate between each: clarify → questions → research → design → outline → plan. Mull stops at the plan. Implementation is a separate job.

The whole point is the split:

    research = what is true
    design   = what should be true
    outline  = in what order
    plan     = exact edits

Never let them mix. Each stage compresses the last and hands the next one a better starting point.

Worth it for unfamiliar code, cross-cutting features, data-model changes, async or UI state — anything where a bad assumption compounds across files. Overkill for a small, obvious change; say so and skip it.

## Scope gate

Before anything else, check the request is mullable:

- It is a **change, not a question**. "Add image upload to the editor" is a task. "Where do we store images?" is a research question this workflow produces for you — don't take it as the task.
- **One concern per run.** If the request is a whole subsystem ("build the backend"), it can't be researched as current truth. Narrow it with the user before starting.

## Setup

Ask the user once, before stage 1, and don't ask again:

> Write the stage docs to disk, or keep this in chat?

- **Disk** — `.mull/<slug>/NN-<stage>.md`, zero-padded, slug derived from the request. Docs survive compaction, session restarts, and handoff to another agent. Prefer this for anything you'd hate to lose. Add `.mull/` to the project's ignore file unless the user wants the docs committed.
- **Chat** — outputs live in the conversation only. Fine for a short session.

Either way the stage sequence, inputs, and gates are identical. "Artifact" below means the file if on disk, the posted stage output if in chat.

## Stage prompts

Stage prompts live in `prompts/` next to this file. Read them one at a time, only when that stage is active. Do not read ahead.

Read `prompts/0-orchestrator.md` now to load the routing rules.

## Stages and their inputs

| # | Prompt | Stage | Reads | Writes |
|---|--------|-------|-------|--------|
| 1 | `1-clarify.md` | clarify_intent | the raw request | `01-clarified-request.md` |
| 2 | `2-questions.md` | research_questions | `01` | `02-research-questions.md` |
| 3 | `3-research.md` | research | `02` **only** | `03-research.md` |
| 4 | `4-design.md` | design_discussion | `01` + `03` | `04-design.md` |
| 5 | `5-outline.md` | structure_outline | `01` + `03` + `04` | `05-structure-outline.md` |
| 6 | `6-plan.md` | plan | everything except `02` | `06-plan.md` |

The `Reads` column is load-bearing, not a suggestion.

**Ticket isolation.** Stage 3 never sees the raw request or the clarified intent. Once research knows the goal, it starts writing the solution into its findings and you lose the one honest account of the codebase. Research and intent meet for the first time at stage 4 — that's what makes stage 4 the important one.

Running stage 3 in a subagent enforces this for free. In a single context you can't unsee the request, so hold the rule explicitly: write only what you verified in the code, and cut any finding you wouldn't have written if you didn't know the goal.

## Delegation

If your runtime can spawn subagents, run each stage and each check in a fresh one. Pass it the stage prompt and the named input artifacts — never the deliberation that produced them. Stage 3 especially: fan out 2–6 parallel subagents grouped **by area of the codebase, not one per question**, and synthesize their findings yourself.

Without subagents, run it all in one context. You keep the structure, but the check gate is weaker — the same mind grading its own work — so bias toward `revise` when in doubt.

## The loop

You play every role: orchestrator, stage, and reviewer. When the orchestrator routes to a stage you immediately become that stage. You do not stop and wait.

Each turn:

1. **Orchestrator** — emit the routing JSON from `prompts/0-orchestrator.md`.
2. **Stage** — read that stage's prompt, then produce its output. Do not stop between 1 and 2.
3. **Check** — read `prompts/check.md`, apply it, emit the verdict JSON.
4. `pass` → back to 1 for the next stage. `revise` or `go_back` → act on it first.

Pause for the user only when a stage prompt says to ask, or when the check raises something that genuinely needs a human answer.

## Iterating on a stage

When the user pushes back mid-stage, update that stage's output in place. Do not restart it, and do not silently accept the correction either:

- **Preferences and decisions** — accept at face value. It's their call.
- **Claims about the codebase** — verify before editing. A correction that's wrong, baked into an artifact, poisons every stage downstream.

## Rewinding

Every artifact is a rewind point. Rough rule for how right the current one is:

    100% → continue
     90% → iterate it live
     80% → fresh context, re-run the stage against the doc
     70% → rewrite the doc with stronger steering
     50% → go back one or two stages

A bad plan needs a new plan. A bad plan caused by the wrong shape needs a new design discussion. A bad design caused by thin context needs more research. Don't keep prompting against a rotten source document.

## Handing off to implementation

The plan is the final authority. Where documents disagree, later wins:

    plan > outline > design > research > clarified request

An implementing agent reads every artifact except `02-research-questions.md`, and works phase by phase with a gate between phases.

Do the thinking on the main checkout. Create the branch or worktree *after* the plan is accepted, so planning artifacts stay out of implementation churn and research stays current.

## Tone

Write like you're thinking alongside the user — concise, direct, collegial. Not filing a report. Skip sections with nothing in them. One line per bullet where possible.

## Rules

- Read only the current stage's prompt.
- Never advance without a check verdict.
- Show the verdict before continuing.
- At most 1–2 questions per turn. Interview-like: ask, wait, continue. Never dump every open decision at once.
- If a later stage reveals an earlier gap, go back and say why.
