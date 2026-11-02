# Delegate in herdr

A worker is a pane. `herdr-delegate` spawns, briefs, waits for a confirmed settle and prints one JSON envelope.

    herdr-delegate count-files 'Count the files in /home/osk/sites/robots, excluding .jj, .git and node_modules. One shell command. Do not edit anything, no commits. Report the number and the command you ran.' \
      --kind pi --timeout 30000 --new-tab workers \
      -- --provider openai-codex --model gpt-6-luna

The `--kind … -- …` tail comes from [models](models.md). Pass a short `--timeout` always; without one a hung worker hangs your shell. Give the first worker `--new-tab workers` and later ones the returned tab ID with `--tab`, four per tab. The tab closes with its last pane; then `--new-tab` again. For raw pane and agent commands, `herdr --skill`.

The name is the worker's address: unique, at most three plain words, `[a-z][a-z0-9_-]{0,31}`. Check `herdr agent list` first.

Every fresh worker is told to send `[worker <name>] BLOCKED: <question>` or `[worker <name>] DONE: <report>` to your pane, so the result arrives as a prompt. Follow up by name:

    herdr-delegate prompt NAME 'TEXT' --timeout <ms>

A slow worker makes the spawn return `error.code: "timeout"`; that is fine, don't resend. If you need the result now, `herdr-delegate wait NAME --timeout 35000` in the background. Both print `classification` (`report`, `blocked`, `error`, `empty`, `never_ran`), `last_message` and `terminal_text`.

When done, `herdr pane close <pane_id>` with the id the spawn returned. Never close the pane it reports to; that is yours.

Things that go wrong: [herdr troubleshooting](herdr-troubleshooting.md).
