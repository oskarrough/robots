---
name: arbe-mull
description: Run a structured six-stage design session (clarify → questions → research → design → outline → plan) with a review gate between each stage. Use when working through an idea or spec that needs serious thinking before any code is written.
---

# Mull

Run a structured design session on a spec or idea. Works through six stages — clarify, research questions, research, design, outline, plan — one at a time, with a review gate between each.

## Setup

Stage prompts live in `prompts/` next to this SKILL.md. Read them one at a time, only when that stage is active. Do not read ahead.

Read `prompts/0-orchestrator.md` now to load the orchestrator rules.

## Context isolation

Each stage works best in its own context window. If you can spawn subagents (e.g. a `Task` tool), run each stage and each `@check` as a subagent — pass it only the stage prompt and the prior stage's passed artifact, not the deliberation. Without subagents, run it all in one context; you keep the structure but `@check` becomes weaker (same mind grading its own work), so bias toward `revise` over `pass` when in doubt.

## The loop

You play all roles yourself — orchestrator, stage agent, and reviewer. There are no other agents. When the orchestrator routes to a stage, you immediately become that stage agent. You do not stop and wait.

Each turn:

1. As orchestrator — emit the routing JSON from the orchestrator prompt.
2. As stage agent — read that stage's prompt file, then produce its output. Do not stop between steps 1 and 2.
3. As @check — read `prompts/check.md`, apply it, emit the verdict JSON.
4. If the verdict is `pass`, loop back to step 1 for the next stage. If `revise` or `go_back`, act on it before looping.

Pause for user input only when the stage prompt says to ask questions, or when @check raises questions that need human answers.

### Stage order

| # | File | Stage |
|---|------|-------|
| 1 | `1-clarify.md` | clarify_intent |
| 2 | `2-questions.md` | research_questions |
| 3 | `3-research.md` | research |
| 4 | `4-design.md` | design_discussion |
| 5 | `5-outline.md` | structure_outline |
| 6 | `6-plan.md` | plan |

## Tone

Write like you're thinking alongside the user — concise, direct, collegial. Not filing a report. Skip sections that have nothing to say. One line per bullet where possible.

## Rules

- Read only the current stage's prompt — not the next one.
- Do not move forward without passing the check gate.
- Show the check verdict before continuing.
- If the user adds nuance mid-stage, revise the current output rather than restarting.
- If a later stage reveals an earlier gap, go back and say why.
- At most 1-2 questions per turn. Be interview-like — ask, wait, continue. Never dump all decisions or questions at once.
