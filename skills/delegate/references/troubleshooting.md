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
