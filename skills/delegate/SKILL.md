---
name: arbe-delegate
description: Hand one outcome to a worker agent in a herdr pane — spawn, brief, read the result, steer, review. Requires HERDR_ENV=1.
---

# Delegate

You own the plan and the review; one worker owns one outcome. Delegate what is cheaper to review than to produce; keep small edits you already understand.

Pick the model from [models](references/models.md) before every spawn.

**Fresh worker, one call.** The envelope *is* the result: handles, the resolved runtime, the worker's final message from its transcript in `last_message`, and its visible screen in `terminal_text` (viewport-sized: cut to pane width and height, so the statusline truncates):

    herdr-delegate NAME 'BRIEF' --kind <kind> --timeout <ms> [--workspace <id>|--tab <workertab>] -- <agent args from models.md>

The wrapper appends the reporting contract and verifies the resolved provider/model/thinking against the requested args before prompting (pi and claude). A `herdr_delegate_runtime_mismatch` at `stage: "verify"` means the worker started on the wrong runtime: close that pane and start over, don't brief it.

`--timeout` bounds the prompt wait, including settle confirmation; leave room in your harness's command timeout for startup and reading the result. Omitted means indefinite, and a hang then kills your shell instead of returning the envelope. On `error.code: "timeout"` at `stage: "prompt"` or `"wait"`, follow with `herdr-delegate wait NAME --timeout <ms>`, never re-prompt: the worker may still be running or awaiting confirmation. On other failures read `stage`, `created`, and `terminal_text`: a preflight or split failure created nothing, while a failed start or prompt leaves its pane for inspection.

**Warm worker** (steer, follow-up, next task), same envelope:

    herdr-delegate prompt NAME 'TEXT' --timeout <ms>
    herdr-delegate wait NAME --timeout <ms>      # resume after a timeout

Budget more than the 20-second confirmation interval for each `wait` (e.g. `--timeout 35000` within a 45-second shell budget). A timeout's screen may show a report, but keep waiting until the envelope classifies it. For parallel workers, start each with a short prompt timeout, then interleave bounded `wait` calls by name.

Both confirm the settle from the worker's transcript, so `last_message` is the report and `classification` says `report`, `blocked`, `error`, `empty`, or `never_ran`. Never raw `agent wait --until done` (misses `idle`), and never move a pane during a live wait. Reset with `herdr agent prompt NAME "/new" --wait --timeout 15000` before unrelated work; it may report `agent_prompt_stalled` while succeeding.

- Names: unique, ≤3 plain words, `[a-z][a-z0-9_-]{0,31}`; address workers by name. The wrapper gives each worker your pane ID for reports. Check `agent list` first; your own pane is in it too.
- Keep workers out of the human's tab: `herdr tab create --workspace $HERDR_WORKSPACE_ID --label workers --no-focus | jq -r .result.tab.tab_id`, pass that as `--tab`. Four workers per tab at most. The tab closes itself when its last pane closes, so after closing a batch create a new tab before the next spawn — a stale `--tab` fails at `stage: "move"` after the pane is already created, in the human's tab (`pane move <id> --new-tab --label workers --no-focus` rescues it).
- Crew: reuse ~4 warm workers for batches; parallelize disjoint files; give a cascading sweep one owner. `pane close` only panes you created.

## Brief

One outcome per brief, reviewable in one sitting. Write it yourself; a file for a long brief, one shared rules file for a crew. Inline any rules the worker needs — it does not have your skills.

- **Ownership:** files allowed and off-limits, including shared dependencies. Others are editing too; a needed change outside scope is a question, not permission.
- **Done-when and checks:** the project's scoped test command from the right directory; never touch lockfiles or shared deps to repair an unrelated failure.
- **Commits:** in a repo, supply `arbe-jj-jujutsu`, binding; outside one, say "no commits". Commit only owned files, one outcome per commit. Leave a shared file's foreign hunks in `@` and report them. Never rewrite history while others are active.
- **Report:** ≤10 plain lines: outcome, files/commits, check results, blockers. Pi workers use their own model, no subagents.

`herdr-delegate` tells every fresh worker where to report, so don't paste this yourself; a warm `prompt` call doesn't repeat it:

> If you need help, send `BLOCKED <name>: <question>` to your delegator with `herdr agent prompt <pane> '<message>'` (no `--wait`), then end your turn with the same line. When finished, send `DONE <name>: <concise report>` the same way, then end with that report.

## Result

`ok` means a report exists, not that it is true. Read `classification`, `last_message`, and the repo:

| classification | repo | do |
| --- | --- | --- |
| `never_ran` | — | read `error.code`: a missing/stopped worker needs replacement; for a stalled prompt inspect `terminal_text`, then resend once when ready |
| `error`, `empty` | no diff | read `terminal_text` for the provider error; fix model or brief, resend once |
| `empty` | diff | ask for the report; keep the work |
| `blocked` | — | answer the worker's `BLOCKED` message with `herdr-delegate prompt`; ask the human before answering a dialog |
| `report` | — | review; corroborate with `jj st` / `jj log` |

Thinking text, tokens, and elapsed time prove nothing. A suggested message sitting in a Claude composer is not an answer: `send-keys NAME esc`.

## Review

Every non-trivial diff gets an independent strong reviewer (see models). Require check output from the final edits. Weigh findings against actual behavior; answer rejected findings in the re-review prompt. Reproduce blocker claims in the current tree before acting — another worker may have fixed it. Ask before commit: "Reread your diff and cut anything not needed for the goal."

Escape hatches, only when needed: `--cwd` only sets the worker's shell directory (default: yours) — put absolute paths in the brief instead; `agent read NAME --source recent-unwrapped --lines 200` for a kind whose transcript herdr-delegate cannot read (`last_message: null` with `classification: report`); [troubleshooting](references/troubleshooting.md) when herdr misbehaves.

Keep this file short: merge lessons into existing bullets, no incident stories. Project-specific rules belong in that project's brief template.

- Run every `herdr-delegate wait` with `run_in_background` (Oskar, 2026-09-12) so the shell stays free; the task notification carries the envelope. A notification saying the command was stopped because the system is low on memory is the harness, not the worker (it happens while a worker runs a typecheck): the pane is still running, so issue the same `wait` again.
- A pane that says `Working` with unchanged token counts for more than five minutes is stalled on the provider (Codex "servers overloaded" retries), not thinking: `agent send-keys NAME esc`, then `herdr-delegate prompt NAME "your last call hung; continue"`. Don't `/new` a pane you mean to reuse — it drops the agent handle (`agent_not_found`); spawn fresh instead.
- Another agent's `jj commit -- <files>` can snapshot your uncommitted hunks into an undescribed commit under its own; before moving `main`, run `jj log -r 'main@origin::@'` and squash any undescribed commit into the change it belongs to, or the push is rejected.
- Verify "deployed" against `/api/version` before reasoning about production behavior: a commit that only exists in this checkout looks deployed from the log.
