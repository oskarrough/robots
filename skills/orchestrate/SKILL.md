---
name: arbe-orchestrate
description: Triage a backlog, design doc, or feature area and prepare work so it's ready to hand to builder agents — surface issues one at a time, wire deps, recommend dispatch order. Use when the user says "orchestrate", "orchestrate only", "triage", or points you at an area to prep for dispatch. This decides *what* to hand off and in what order; to actually run the workers, see arbe-delegate.
---

# Orchestrate

## What you produce

A dispatch plan the human can approve in a few minutes. Decisions, not code and not a research report.

You are not building these tasks. You are making each one safe to hand over: right status, real scope, no duplicates, dependencies wired, a sane order. Once the human approves, `arbe-delegate` launches the builders.

Investigate freely to get there — `librarian` to locate scope, `oracle` to weigh a design call — rather than reading everything yourself. Keep the conclusion, not the files.

## How to say it

Every turn should end with the human able to answer in one word.

**Name every task as `short title (arbe-xxxx)`.** Derive the short title yourself — three or four words for what it actually is — even when the tracker's own title is a sentence. `arbe-8d6b` alone is unreadable; `self-host durable streams (arbe-8d6b)` needs no lookup. Do it in findings, questions, dependency maps, and dispatch order alike.

**A question must stand alone.** No "as recommended above", no "still pending from before". The reader should never scroll to answer. Name the task, name the choice, and keep the options to one word each: close / rewrite / split / defer / merge.

**Lead with the decision, not the derivation.** One line for what is wrong, one line for what to do. Commit ids, timestamps, and file paths are proof you hold in reserve — offer them if the human pushes back, never open with them. A finding that needs a table is a finding you have not finished thinking about. `arbe-bro` is the register.

Put every question in one block at the very end of the turn.

## Process

If the entry point is unclear, ask whether to focus on a design doc, a set of tasks, a feature area, or the full backlog. If the user named one, begin there.

Surface one finding with a concrete recommendation, then wait for the human's call. Walls of findings hide decisions.

### 0. Establish project context

Use the project's own tracker when local instructions, docs, config, or the user explicitly bind one to this repository. An installed tool, personal tracker, or neighbouring project's tracker proves nothing. No tracker is a valid state; keep proposed tasks in the conversation rather than inventing or initializing one.

When a tracker exists, pull its existing tasks for the area first so the triage does not duplicate them.

**A task's status is a claim, not a fact. Check it against the repo before you triage on it.** Work lands in commits that never name the task, so `in_progress` can mean nobody is on it and `open` can mean half of it already shipped to production. Two p1 tasks in one session were stale by a working day this way, and a builder dispatched on either would have redone finished work.

Read recent history for the area and match it against the set — a day of commit subjects, not a keyword grep. Searching commit messages for the task id or the task's own words finds nothing: real subjects say what changed, so the commits that finished "palette latency baseline" read "Palette submit is one optimistic verb" and "Thread create sheds serial round trips". A closed task's `close_reason` is often where the evidence actually lives.

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
- a status that matches the repo, not just the tracker (step 0)
- dependencies recorded in the tracker or made explicit in the plan
- no file conflicts with tasks in the same batch

### 4. Recommend dispatch order

Present what can run in parallel, what must run sequentially, and why. The human decides when to launch builders.

Some tasks are not worth a worker. A one-file edit you already understand may be faster to do than to brief.

Keep track of everything surfaced and confirm the final plan drops nothing.
