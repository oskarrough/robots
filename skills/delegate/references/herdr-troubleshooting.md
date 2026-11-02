# Delegate: troubleshooting

Recovery for things SKILL.md doesn't name. Each entry is tagged with its exit: `[herdr bug]` file it and delete when fixed, `[ours]` a provider fact that stays until the provider changes.

- `[herdr bug]` **`agent prompt` succeeds while the text never landed** — a never-started worker is `idle` like a finished one. `herdr-delegate` and `herdr-delegate prompt` surface it as `classification: never_ran` (herdr's `agent_prompt_stalled`); a raw `agent prompt` has no such gate, so read the pane and resend once.
- **A killed worker loses its name** — its shell and pane may survive, but Herdr drops the agent handle. `herdr-delegate prompt` returns `never_ran` with `agent_not_found` or `agent_not_running`; `wait` cannot revive it. Close only the pane you created and replace the worker if the task requires recovery.
- `[herdr bug]` **`pane move` silently no-ops on a zoomed tab** — `pane zoom <pane-id> --off` first. `herdr-delegate --tab` reports this as `stage: "move"` with `created: true`: the worker is started but unprompted, so follow with `herdr-delegate prompt <name>`, not a respawn.
- `[herdr bug]` **Past 4 panes in a tab `agent read` returns confetti** — ignore `terminal_text` and use `last_message`, which comes from the transcript. For a kind herdr-delegate cannot read, the transcript path is `herdr agent get <name> | jq -r .result.agent.agent_session.value`.
- **`agent stop` does not exist** — `send-keys <name> esc`, then `pane close` once settled.
- `[ours]` **OpenRouter `Provider finish_reason: error`** ends a turn but keeps the session. Prompt "continue, that was a transient provider error" once; recurring means a smaller brief or another model.
- `[ours]` **A prompt sent while pi is self-compacting is silently eaten** — if status never leaves idle, read the pane and resend. Don't `esc` a compaction, and don't resend the automatic "Queued message for after compaction".
- `[ours]` **glm-5.3-flash hangs with zero token movement** (`↑Nk` frozen, `esc` ignored). If `jj st` shows nothing for its task, close and restart; split the brief or escalate.
- **`--timeout` hit at `stage: "prompt"` or `"wait"`** — follow with `herdr-delegate wait NAME --timeout <ms>`, never re-prompt. Other failures: read `stage`, `created`, `terminal_text`. A preflight or split failure created nothing; a failed start or prompt leaves its pane for inspection.
- **`--cwd`** only sets the worker's shell directory (default: yours); put absolute paths in the brief instead.
- **`last_message: null` with `classification: report`** — a kind whose transcript herdr-delegate cannot read; `agent read NAME --source recent-unwrapped --lines 200`.
- **Never raw `agent wait --until done`** — it misses `idle`. Never move a pane during a live wait.
- **`/new` to reset a warm worker** (`herdr agent prompt NAME "/new" --wait --timeout 15000`) may report `agent_prompt_stalled` while succeeding, and can drop the agent handle (`agent_not_found`). Prefer spawning fresh.
- **A wait notification saying the command was stopped for low memory** is the harness, not the worker (happens during a worker's typecheck): the pane is still running, issue the same `wait` again.
- **`Working` with unchanged token counts for more than five minutes** is stalled on the provider (Codex "servers overloaded" retries): `agent send-keys NAME esc`, then `herdr-delegate prompt NAME "your last call hung; continue"`.
- `[ours]` **Another agent's `jj commit -- <files>` can snapshot your uncommitted hunks** into an undescribed commit under its own. Before moving `main`, `jj log -r 'main@origin::@'` and squash any undescribed commit into the change it belongs to, or the push is rejected.
- `[ours]` **Verify "deployed" against `/api/version`** before reasoning about production: a commit that only exists in this checkout looks deployed from the log.
- **`herdr_delegate_runtime_mismatch` at `stage: "verify"`** — the worker started on the wrong model. Close that pane and spawn again; don't brief it.
- **A suggested message sitting in a Claude composer** is not an answer: `send-keys NAME esc`.
- **`wait` needs more than the 20-second confirmation interval** (`--timeout 35000` in a 45-second shell budget). A timeout's screen may show a report; keep waiting until `classification` says so.
- **`never_ran`** — read `error.code`: a missing or stopped worker needs replacement; a stalled prompt, inspect `terminal_text` and resend once.
- **Stale `--tab`** fails at `stage: "move"` with the pane already created in the human's tab; `pane move <id> --new-tab --label workers --no-focus` rescues it. Don't `tab create` yourself first: it adds a shell pane the worker then sits beside.
- **Never move a pane during a live wait**; the wait breaks while the worker continues.
- **`empty` with a diff** — ask for the report and keep the work. **`error` or `never_ran`** — read `terminal_text`, fix model or brief, resend once. A worker at a permission dialog: ask the human before answering it. Tokens and elapsed time prove nothing.
