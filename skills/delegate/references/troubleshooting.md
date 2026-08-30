# Delegate: troubleshooting

Recovery procedures for things that have already gone wrong. Read when a herdr command errors or a worker misbehaves in a way SKILL.md doesn't name.

**This file is meant to shrink to nothing.** Almost none of it is delegation judgment — it's herdr defects and provider quirks parked here because they cost real time. Each entry is tagged with how it leaves: `[herdr bug]` file it and delete the entry when fixed, `[herdr docs]` belongs in `herdr --skill`, `[ours]` a real provider fact that stays until the provider changes. Don't add an entry without a tag and an exit.

## herdr commands

- `[herdr bug]` **`agent prompt` can return success while the text never landed.** The expensive one — a never-started worker is `idle` exactly like a finished one. Guard per SKILL.md §3 (context % off `0.0%`), resend once.
- `[herdr bug]` **`--source recent-unwrapped` can return empty for pi panes**; `visible` works. Contradicts herdr's own docs, which recommend recent-unwrapped for transcripts.
- `[herdr bug]` **`pane move` silently no-ops on a zoomed tab** — `pane zoom <pane-id> --off` first. Never disturbs a live agent otherwise.
- `[herdr bug]` **`agent_pane_busy` right after `pane split`** — wait ~5–10s and retry `agent start` once; still refusing is a dud pane, close and split fresh.
- `[herdr bug]` **`/new` returns `agent_prompt_stalled`** — slash commands finish instantly, so herdr sees no state change. Confirm with `agent read`.
- `[herdr docs]` **`--wait` timeout ≠ stuck** — exits 1 with `{"error":{"code":"timeout"}}` but the worker is usually still working. Don't re-prompt; poll `agent get` until `agent_status` leaves `working`.
- `[herdr docs]` **`agent stop` does not exist** — halt a worker with `send-keys <name> esc`, then `pane close <pane>` once it's truly done.
- `[herdr docs]` **Result envelopes aren't uniform** — `pane split` returns `.result.pane`, `pane move` doesn't. Verify with `pane list` rather than trusting a field name across commands.

## Workers that settle wrong

SKILL.md §3 has the general rule: `done` with no assistant text is not a completion. Two providers fail that way for reasons worth naming.

- `[ours]` **`Codex error: The usage limit has been reached`** settles as `done` ~15s after briefing with nothing done — a fast `done` on a big slice is the tell. Rebuild with a different model and tell the human their sub quota is out.
- `[ours]` **A prompt sent while pi is self-compacting is silently eaten** — if `agent_status` never leaves idle, read the pane and re-send. "Queued message for after compaction" fires on its own; don't re-send that, and don't `esc` a compaction near the finish line.
- `[ours]` **Switching a pi model mid-session is unreliable** — `/model` opens a picker the full `id:level` string doesn't match. If the model matters, rebuild the pane with the right start args. Claude Code takes `/model opus` directly.

## Reading a pane that won't read

`[herdr bug]` Past 4 panes in a tab `agent read` returns confetti — panes go ~15 columns wide. Read the transcript from disk instead:

```sh
f=$(herdr agent get <name> | jq -r .result.agent.agent_session.value)
# Claude Code sessions:
jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text' "$f" | tail -60
# pi sessions — records nest one level deeper:
jq -r 'select(.type=="message" and .message.role=="assistant") | (.message.content[]? | select(.type=="text") | .text)' "$f" | tail -60
```

`[herdr docs]` `agent get` nests everything under `.result.agent` (`.agent_status`, `.agent_session`) — a guessed shorter path returns null rather than erroring, so a watcher built on it waits forever. Same trap with a top-level `.role` filter on a pi session: silence that reads as "no report".
