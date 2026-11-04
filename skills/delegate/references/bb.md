# Delegate in bb

A worker is a child thread. These are all the commands you need; don't read bb guides or list providers.

```sh
bb thread spawn --project "$BB_PROJECT_ID" --parent-self --title '<short name>' \
  --provider <provider> --model <model> --reasoning-level <level> \
  --prompt-file brief.md --json
```

Add `--new-environment worktree --base-branch main` when the worker should have its own checkout; leave it out to share yours (then the brief names the files others are in). `--machine <name>` runs it elsewhere, e.g. perf work on hetzner.

`--parent-self` wakes you when the worker ends a turn, so carry on meanwhile. Idle isn't done: a worker idle without its report gets told to finish.

Fire and forget: leave out `--parent-self` when the outcome lands somewhere durable (an issue, a PR) and you'll read it there, or the thread wakes you on every turn it ends. A lead running many workers does this.

```sh
bb thread tell <id> '<follow-up>'            # answer, steer, or "step 2"
bb thread output <id>                        # its final message
bb thread wait <id> --timeout 9m             # only when you have nothing else to do
bb thread archive <id>                       # when done with it
bb thread list --project "$BB_PROJECT_ID" --json | jq -r '.[] | select(.status != "idle") | .title'   # who's still running
```

Use `--prompt-file` for anything longer than a line: inside double quotes the shell eats backticks and `$(...)`.
