---
name: arbe-delegate
description: Hand one outcome to a worker agent — pick the model, brief, steer, review. Works in herdr, bb and t3. Use when work is worth another agent's context, not for small edits you already understand.
---

Delegate a task to a worker: another coding agent with its own context. You own the design and the review; the worker owns one outcome. Not for small edits you already understand.

## Where you are

Spawn with whatever harness you're running in. Each page has the commands:

- `BB_THREAD_ID` set: [bb](references/bb.md)
- `HERDR_ENV=1`: [herdr](references/herdr.md)
- t3 tools (`delegate_task`) available: [t3](references/t3.md)

Pick the model per task from [models](references/models.md). Spread parallel workers across providers so one rate limit doesn't stall everything.

## Brief

One outcome, reviewable in one sitting. Inline every rule the worker needs; it does not have your skills.

- **Done list:** numbered, and the report gives each item's status. Workers otherwise call done halfway.
- **Ownership:** files allowed and off-limits. Others are editing too; a needed change outside scope is a question, not permission.
- **Check:** the project's scoped check command. If the work is something a person uses, the worker uses it before reporting: plays the feature, opens the page, runs the command.
- **Commits:** in a repo, supply `arbe-jj-jujutsu`, binding; outside one, say "no commits". Only owned files, one outcome per commit. If the project lands straight on main, say so.
- **Learnings:** anything that cost the worker time becomes one sentence in the repo's AGENTS.md, in the same commit.
- **Report:** at most 10 plain lines: outcome, commits, check results, blockers. No subagents.

## Steer

Spawn, then carry on with your own work; the report arrives as a message. Answer a blocked worker by name. A new outcome gets a fresh worker; a warm one fed task after task fills its context. The exception is staged work: "step 2" to the worker that finished step 1 beats briefing a stranger.

## Review

For a read-only task, the report is the answer. For edits, read the diff, not the report.

If the diff is more than trivial, a fresh worker from another model family reviews it (see [models](references/models.md)). Give it the diff and the goal, not your opinion. Reproduce any blocker it finds before acting; the first worker may already have fixed it. One review pass, at most one fix round. Before the commit, ask the implementing worker: "Reread your diff and cut anything not needed for the goal."

Keep this file short; harness quirks go in its page, project rules in that project's AGENTS.md.
