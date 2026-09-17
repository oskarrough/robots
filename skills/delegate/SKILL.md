---
name: arbe-delegate
description: Hand one outcome to a worker in a herdr pane — spawn, brief, steer, check, review. Requires HERDR_ENV=1.
---

Delegate a task to a worker: another coding agent in its own `herdr` pane. You own the design and the review; the worker owns one outcome. Not for small edits you already understand.

    herdr-delegate count-files 'Count the files in /home/osk/sites/robots, excluding .jj, .git and node_modules. One shell command. Do not edit anything, no commits. Report the number and the command you ran.' \
      --kind pi --timeout 30000 --new-tab workers \
      -- --provider openrouter --model z-ai/glm-5.3-flash

That is the whole thing for a read-only task. Pick the `--kind … -- …` tail from [models](references/models.md) per task. Pass a short `--timeout` always; without one a hung worker hangs your shell. Give the first worker `--new-tab workers` and later ones the returned tab ID with `--tab`, four per tab. The tab closes with its last pane; then `--new-tab` again. For raw pane and agent commands, `herdr --skill`.

The name is the worker's address: unique, at most three plain words, `[a-z][a-z0-9_-]{0,31}`. Check `agent list` first.

## Messages, not waiting

`herdr-delegate` tells every fresh worker to send `[worker <name>] BLOCKED: <question>` or `[worker <name>] DONE: <report>` to your pane and to end its turn with the same line. So spawn, then carry on with your own work; the message arrives as a prompt. Answer a `BLOCKED`, or give a warm worker its next task, by name:

    herdr-delegate prompt NAME 'TEXT' --timeout <ms>

A slow worker makes the spawn call return `error.code: "timeout"`; that is fine, don't resend. If you need the result now and no message has come, `herdr-delegate wait NAME --timeout 35000` with `run_in_background`. Both `prompt` and `wait` print JSON with `classification` (`report`, `blocked`, `error`, `empty`, `never_ran`), `last_message`, and `terminal_text`.

## Brief, when the worker edits files

One outcome, reviewable in one sitting. Inline every rule the worker needs; it does not have your skills. A file for a long brief, one shared rules file for a crew.

- **Ownership:** files allowed and off-limits. Others are editing too; a needed change outside scope is a question, not permission.
- **Done-when:** the project's scoped check command from the right directory. Never touch lockfiles or shared deps to fix an unrelated failure.
- **Commits:** in a repo, supply `arbe-jj-jujutsu`, binding; outside one, say "no commits". Commit only owned files, one outcome per commit. Never rewrite history while others are active.
- **Report:** ≤10 plain lines: outcome, files/commits, check results, blockers. No subagents.

## Check and review

For a read-only task, the report is the answer. For edits, the diff is: read `jj diff` once instead of the report.

If the diff is more than trivial, spawn a fresh worker on a strong model (see models) to review it. Give it the diff and the goal, not your opinion. Reproduce any blocker it finds in the current tree before acting on it; the first worker may already have fixed it. Send rejected findings back to the reviewer with your reasoning. Before the commit, ask the implementing worker: "Reread your diff and cut anything not needed for the goal."

When done with a worker, `herdr pane close <pane_id>` using the id its spawn returned. Never close the pane it reports *to*; that is yours.

When herdr misbehaves: [troubleshooting](references/troubleshooting.md). Keep this file short; lessons go there, project rules go in that project's brief template.
