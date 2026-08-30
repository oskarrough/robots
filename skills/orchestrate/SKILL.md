---
name: arbe-orchestrate
description: Triage a backlog, design doc, bug report, or feature area and prepare work so it's ready to hand to builder agents — surface issues one at a time, wire deps, recommend dispatch order. Use when the user says "orchestrate", "triage", reports something broken, or points you at an area to prep for dispatch. This decides *what* to hand off and in what order; to actually run the workers, see arbe-delegate.
---

# Orchestrate

## The job

Things arrive — a bug report, a design doc, a stale backlog, a vague wish. For each one, work out what it really is, whether it is already tracked, whether it is worth doing now, and who should do it next. Hand back a dispatch plan the human can approve in a few minutes: decisions — not code, not a research report, not a design.

You are not building or solving these tasks. You make each one safe to hand over: right status, real scope, no duplicates, dependencies wired, a sane order. Once the human approves, `arbe-delegate` launches the builders.

The one thing that must live in your context is judgement about this project — what matters this week, what is a distraction, which two items are secretly the same. Everything else gets delegated.

## Commit discipline

Triage decisions are not commit boundaries. Batch task bodies, statuses, dependencies, and discovered follow-ups for one product theme into one commit after the theme is settled. If later decisions rewrite the same task, squash them into that theme commit instead of preserving the conversation as history. Before handoff, inspect jj log and consolidate same-domain administrative commits; keep genuinely separate shipped outcomes and unrelated human/agent work separate. Never reshape history while builders are active.

## Delegate the reading

Don't read source files to answer a question — send someone, and ask for the conclusion, not the files:

- locating scope, finding what owns a behaviour, checking whether something already exists — `librarian`
- weighing a design call or a risky plan — `oracle`
- reading history, working through a doc, updating a batch of task bodies — a subagent, or `arbe-delegate` for anything long-running

A good subagent hands back three lines. One that hands back a file dump was briefed wrong.

Two things you do read yourself: task bodies in the tracker (the triage depends on them), and a single source file you already know when the call is pure taste.

## Writing to the human

Five rules. The examples below show them applied.

1. **One decision per message, stated once.** A finding lives inside its numbered question — never in prose first and the question again after. Don't bundle a close, an unrelated offer, and a new question into one message. Clean checks and tidy-ups you already made are one clause in the header line, or cut.

2. **Decision first, in product terms, evidence in reserve.** Open with what is wrong and what to do about it, stated as a user would meet it — no layer jargon (RPC, RLS, gate), no invented codenames. Task-id chains, file paths, commit hashes, and theme inventories are proof you offer only if the human pushes back. If a finding seems to need a table, you haven't finished thinking it through.

3. **Every question stands alone and picks one option.** No "as recommended above", no second ask tacked onto the end. Name the concrete change — which task moves, what it depends on afterwards, what stops happening — and say which way you'd go. Two options with no pick makes the human redo your thinking.

4. **Cite tasks as `short title (arbe-xxxx)`, and say what's left.** Derive the short title yourself — three or four words for what it actually is — everywhere you cite an id. Include the remaining count ("5 tasks left to triage") so the human can pace against the queue.

5. **Don't narrate.** No "let me check", no "I'll pull the backlog" — the human watches the tool calls go by. Report results, not intentions. One exception: the first message opens with a line or two naming the set you're triaging and what you'll hand back. Formatting: plain markdown — bold task names, numbered questions, nothing else. No blockquotes (a `>` renders as a dim bar in the terminal), no tables, no italics, no nested bullets.

Too much:

```markdown
I've pulled all 36 open tasks and grouped them by theme: transports (3), thread
bugs (4), CLI contract (5), search (2), plus the rest. Nothing is flagged
blocked. Let me start on the p1 set while a staleness check runs.

First finding: **palette latency baseline (arbe-1f30)** looks stale. Grepping
the log for "1f30" and for "palette latency" returns nothing, but the commit
"Palette submit is one optimistic verb" (`a4c31f0`, Monday) touches
`apps/web/src/palette/submit.ts` and removes the round trip the task was written
to measure. So the measurement work is done — though the task also asks for a
regression guard in CI, which is not there.

**Questions** (1 open)

1. **palette latency baseline (arbe-1f30)** — the latency work shipped Monday in
   "Palette submit is one optimistic verb", but the CI regression guard the task
   also asks for was never added. Close it as overtaken, or rewrite it? I'd rewrite.
```

Enough:

```markdown
Triaging 36 open tasks, grouped by theme. I'll hand back a dispatch order.

**Questions** (1 open, 5 tasks left to triage)

1. **palette latency baseline (arbe-1f30)** — the latency fix shipped Monday, so
   most of this task is already done. What is left is the CI check that stops it
   coming back. I'd shrink the task down to that check and keep it open. Close it
   outright instead?
```

## Process

Surface one finding with a concrete recommendation, wait for the human's call, then act. This one-at-a-time rule covers everything below: filing tasks, rewriting them, closing them, decomposing docs.

### When the human reports something

"j/k scroll instead of moving the selection" is a task to file, not a problem to solve. Don't diagnose it, don't open the implementation, don't propose a fix. Check the backlog for a task that already covers it; if none does, draft one and show it.

A task body is framing and goal, never solution: what is wrong, what right looks like, roughly where it lives — two or three lines. How to do it is the builder's job, and a design you guessed at without reading the code narrows a capable agent down to your guess.

### 0. Establish project context

Use the project's own tracker only when local instructions, docs, config, or the user bind one to this repository. An installed tool, a personal tracker, or a neighbouring project's tracker proves nothing. No tracker is a valid state — keep proposed tasks in the conversation rather than inventing one.

When a tracker exists, pull its tasks for the area first so the triage doesn't duplicate them. Treat each task's status as a claim, not a fact: `in_progress` can mean nobody is on it, `open` can mean it shipped last week. Before triaging, have a subagent check the set against the repo. Don't have it grep for task ids or task titles — commit subjects say what changed, not which task they close (the commit that finished "palette latency baseline" reads "Palette submit is one optimistic verb"). Instead ask for a day of commit subjects across the area, plus `close_reason` on anything already closed, and match by meaning.

Then pick the entry path:

- a report of something broken or wanted — file it, don't solve it (above)
- a feature area — map the code and existing tasks; ask what is half-built, what is wrong, and what is in scope before proposing tasks
- a design doc — compare doc against code and tasks; say whether it is fully, partly, or not yet decomposed, or obsolete. With approval, make each task actionable without rereading the doc, and preserve any deferred remainder in the tracker or handoff
- supplied tasks or a filter — pull the set and check each description is actionable
- a full backlog — pull everything open; group a long list by theme. If no backlog location is established, ask where it lives

If the entry point is genuinely unclear, ask which of these it is.

### 1. Map dependencies

Read every task in the set. Draw what blocks what and what can run in parallel. Flag missing dependencies and cycles. Use `librarian` to ground file and scope questions in the code.

### 2. Surface issues

In priority order, one at a time:

- work that must deploy atomically — merge it, or add a blocked dependency and deploy note
- duplicate or overlapping tasks
- descriptions too vague to know when they're done
- tasks that will conflict in the same files
- tracking or epic tasks cluttering the ready queue
- work implied by a design doc but not tracked
- open design questions missing from the task

### 3. Verify dispatch readiness

Each task needs:

- enough context for an agent to act without questions — what is wrong, what done looks like, where it lives; not how
- a status that matches the repo, not just the tracker (step 0)
- dependencies recorded in the tracker or explicit in the plan
- no file conflicts with tasks in the same batch

### 4. Recommend dispatch order

Present what runs in parallel, what runs sequentially, and why. The human decides when to launch builders. Some tasks aren't worth a worker — a one-file edit you already understand is faster to do than to brief. Confirm the final plan drops nothing that was surfaced.
