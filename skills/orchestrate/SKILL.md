---
name: arbe-orchestrate
description: Triage a backlog, design doc, or feature area and prepare work so it's ready to hand to builder agents — surface issues one at a time, wire deps, recommend dispatch order. Use when the user says "orchestrate", "orchestrate only", "triage", or points you at an area to prep for dispatch. This is the triage half; live in-session delegation (librarian/oracle/arbe) is governed by the arbe prompt.
---

# Orchestrate

Triage and prepare work so each piece is ready to hand to a builder agent.

Two senses of "dispatch" — keep them straight:
- **Preparing tasks** (this skill): you triage the backlog and make each task actionable. You recommend an execution order; the human launches the builder agents (or you do, if asked). You don't start building the tasks yourself.
- **Investigating to triage** (the arbe prompt): delegate freely. Fan out `librarian` to locate scope and `oracle` to weigh a design call rather than reading everything yourself. Triaging well means leaning on subagents to answer the questions for you — that's encouraged here, not forbidden.

So: delegate hard for the *investigation*, but don't silently start *implementing* the tasks you're triaging. Surface the plan first.

## Process

Start by asking: **focus on a design doc, a set of tasks, or the full backlog?**

Work through one issue at a time. Each pass: surface one finding, include a concrete recommendation, and wait for the human's call before moving on. Don't batch findings into walls of text.

Always refer to tasks by title, not just ID — IDs are not memorable.

### 0. Pick the entry point

Whatever the entry point, **pull the existing tasks for the area first** (`arbe task list`). Triage is *against what's already tracked* — skip this and you'll propose work that's already a task. This is the step that grounds everything below.

**Feature area / code surface** — when the human points at a surface, not a doc or task list ("work the workflows UI", "the auth flow"):
- Fan out `librarian` to map what exists and how it's built — but in the same pass, list the open tasks already filed against that area so your punch-list doesn't duplicate them.
- Then surface intent questions grounded in both: what's half-built, what's bugging the user, what's in/out of scope.
- Decompose into tasks only with approval, same as below.

**Design doc** — when the human points at a doc under `docs/` (often `docs/specs/`):
- Read the doc. Is it still accurate, or has the codebase moved past it?
- Check which tasks already exist for it. Are they complete, partial, or missing?
- Surface one finding at a time: "this is fully decomposed" or "no tasks yet, want me to decompose it?" or "this contradicts the code now, probably obsolete — want me to open a task to revisit?"
- Decompose into tasks only with approval. Each task should be actionable without re-reading the doc — pull the relevant context into the task description.
- If partially decomposed and the rest isn't being tackled now, create a chore task to orchestrate the remainder later. Don't leave work without a trail.

**Tasks** — when the human points at specific tasks or a filter (priority, type, tag):
- Pull the set with `arbe task list` or the relevant filter.
- Skim descriptions. Are they actionable as-is, or do some need fleshing out?
- Proceed to step 1.

**Backlog** — full sweep of everything open:
- `arbe task list` for the full picture.
- Group by theme or area if the list is long — triage one group at a time.
- Proceed to step 1.

### 1. Map dependencies

Read every task in the set. Draw the dependency graph: what blocks what, what can parallelize. Flag missing deps and cycles. Offload the "where does this live / what does it touch" lookups to `librarian` so the graph is grounded in the real code, not guesses.

### 2. Surface issues

One at a time, in priority order:

- tasks that must deploy atomically — should they merge or use blocked + a deploy note?
- duplicate or overlapping tasks
- tasks whose descriptions are too vague for an agent to act on
- tasks that touch the same files and will conflict
- tracking/epic tasks that are cluttering the ready queue
- missing tasks implied by the design doc but not yet created
- open design questions that should be captured on the task

For each: state the issue, recommend an action, ask if you should do it.

### 3. Verify dispatch readiness

Once issues are resolved, confirm each task has:
- a description an agent can act on without asking questions
- correct status (open, blocked, in_progress)
- deps wired so `arbe task ready` shows the right execution order
- no file-level conflicts with sibling tasks in the same batch

### 4. Recommend dispatch order

Present the final plan: which tasks to dispatch in parallel, which sequentially, and why. The human makes the call on launching the builders.

## Rules

- Don't start implementing the tasks you're triaging — present the plan, the human decides when to dispatch the builders. (Delegating `librarian`/`oracle` to *investigate* is fine and encouraged.)
- Don't fix task descriptions silently — propose changes, wait for approval.
- If a design doc exists, read it before triaging. Tasks should conform to the doc.
- Keep a mental checklist of everything surfaced. At the end, confirm nothing was dropped.
