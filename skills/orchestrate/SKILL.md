---
name: arbe-orchestrate
description: Triage a backlog, design doc, or feature area and prepare work so it's ready to hand to builder agents — surface issues one at a time, wire deps, recommend dispatch order. Use when the user says "orchestrate", "orchestrate only", "triage", or points you at an area to prep for dispatch. This decides *what* to hand off and in what order; to actually run the workers, see arbe-delegate.
---

# Orchestrate

Triage and prepare work so each piece is ready to hand to a builder agent.

Delegating to investigate and delegating to build are easy to blur. Investigate freely — `librarian` to locate scope, `oracle` to weigh a design call — rather than reading everything yourself. But don't start building the tasks you're triaging: make each one actionable, recommend an order, and let the human approve the plan. Once it's approved, `arbe-delegate` covers launching the builders.

## Process

If the entry point is unclear, ask whether to focus on a design doc, a set of tasks, a feature area, or the full backlog. If the user named one, begin there.

Surface one finding with a concrete recommendation, then wait for the human's call. Walls of findings hide decisions.

Refer to tasks by title, not just ID. IDs are not memorable.

### 0. Establish project context

Use the project's own tracker when local instructions, docs, config, or the user explicitly bind one to this repository. An installed tool, personal tracker, or neighbouring project's tracker proves nothing. No tracker is a valid state; keep proposed tasks in the conversation rather than inventing or initializing one.

When a tracker exists, pull its existing tasks for the area first so the triage does not duplicate them.

Choose the entry path:

- For a feature area, map the code and existing tasks. Ask what is half-built, what is wrong, and what is in scope before proposing tasks.
- For a design doc, compare the doc with the code and existing tasks. Surface whether it is fully, partly, or not yet decomposed, or obsolete. With approval, make each task actionable without rereading the doc. Preserve any deferred remainder in the tracker or handoff.
- For supplied tasks or a filter, pull the set and check whether each description is actionable.
- For a full backlog, pull everything open and group a long list by theme. If no backlog location is established, ask where it lives.

Decompose or record tasks only after approval.

### 1. Map dependencies

Read every task in the set. Draw what blocks what and what can run in parallel. Flag missing dependencies and cycles. Use `librarian` to ground file and scope questions in the code.

### 2. Surface issues

Work through these in priority order, one at a time:

- work that must deploy atomically; merge it or use a blocked dependency and deploy note
- duplicate or overlapping tasks
- descriptions too vague for an agent
- tasks that will conflict in the same files
- tracking or epic tasks cluttering the ready queue
- work implied by a design doc but not tracked
- open design questions missing from the task

For each, state the issue, recommend an action, and ask before changing the task.

### 3. Verify dispatch readiness

Confirm each task has:

- enough context for an agent to act without questions
- the correct status, when statuses are tracked
- dependencies recorded in the tracker or made explicit in the plan
- no file conflicts with tasks in the same batch

### 4. Recommend dispatch order

Present what can run in parallel, what must run sequentially, and why. The human decides when to launch builders.

Some tasks are not worth a worker. A one-file edit you already understand may be faster to do than to brief.

Keep track of everything surfaced and confirm the final plan drops nothing.
