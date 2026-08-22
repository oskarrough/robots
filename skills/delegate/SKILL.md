---
name: arbe-delegate
description: Delegate work to agent panes via herdr — spawn a pane, start an agent of any kind, brief it, read the result, steer or stop it. Same commands whether you orchestrate from Claude Code, pi, or Codex.  Use for parallelizable or throwaway work you don't want in your own context. To decide *what* to hand off and in what order, see arbe-orchestrate.
---

# Delegate

Hand work to another agent running in a herdr pane — parallelizable legwork, implementation or research that should run in someone else's context.

`herdr --skill` is the CLI guide: IDs, pane/agent commands, lifecycle states, read sources. Read it for mechanics. This skill is the layer on top — who to hire, how to brief, how to review.

Below are failure modes, not laws. Each one bit someone once; recognise the shape and use judgment. When one contradicts `herdr --skill` or what the tool actually does today, the tool wins — check, then fix this file.

Precondition: `test "${HERDR_ENV:-}" = 1`. Workers go in panes rather than headless `pi -p`, so you can watch and steer them.

Not worth delegating: a single file edit you already understand, work needing context only you hold, anything faster to do than to brief.

Two modes: **delegate and return** (start, brief, wait, read — the default), or **launch and hand off** (start it, report name + pane ID to the human, leave).

## 1. Pick a worker

Three axes, no model wins all three: **price, speed, trust** — trust being how much of its diff you can take on faith. Pick per role:

- **orchestrator** — smart. That's you.
- **implementer** — the cheapest model that can hold the brief.
- **reviewer** — smart, and never the model that wrote the diff.

Smart direction + smart review + cheap implementation beats one expensive model doing all three. That only holds while the review actually happens (§4). Escalate the implementer when a brief keeps failing, not by default.

Kind first, model second — the kind picks which account pays.

| account | reach it with | what it's for |
| --- | --- | --- |
| Anthropic sub | `--kind claude` | Anthropic models. Log-tracing, timing analysis, the review gate. |
| Codex sub | `--kind pi --provider openai-codex` | sol. Never the `openai/...` id — that routes via OpenRouter and pays per token for a model the sub covers. |
| Cursor sub | `--kind cursor` | grok. Effort baked into the id (`-low`/`-high`/`-xhigh`), not a `:suffix`. **Never a `-fast` variant** — costs far too much for the latency. `cursor-agent models` lists everything. |
| OpenCode Zen (beta) | `opencode2` | Ox Alpha Free. Free while the preview lasts. |
| OpenRouter credits | `--kind pi` (default provider) | everything else, deepseek included. Paid per token. |

| model | price | speed | trust | use it as |
| --- | --- | --- | --- | --- |
| `opencode/x-preview-f-free#high` via `opencode2` | free preview | fast | high | Ox Alpha Free. Strong implementer, 1M context. Prefer while free. |
| `deepseek/deepseek-v4-flash-0731:high` | very cheap | fast | medium | default implementer. Tight briefs — renames, ports, single-module features, test runs. |
| `deepseek/deepseek-v4-pro-0813:high` | cheap | medium | medium-high | implementer for briefs flash failed twice. |
| `cursor-grok-4.6-high` (`--kind cursor`) | sub | fast | medium-high | implementer. |
| `gpt-5.6-sol:medium` (Codex sub) | sub | medium | high | workhorse implementer — right for anything spanning layers. |
| `gpt-5.6-sol:high` | sub | slow | highest | hardest work only: cross-layer, subtle concurrency. |
| Opus 5 (`--kind claude -- --model opus --effort <level>`) | sub | medium | highest | the reviewer, and the escalation target. `--effort xhigh` for hard implementation. |

**Which account has headroom changes week to week — ask Oskar before assuming anything is free.** These two tables are the only place volatile ids live.

```sh
herdr agent start <name> --kind claude --pane <pane-id> -- --model opus --effort high
herdr agent start <name> --kind pi --pane <pane-id> -- --provider openai-codex --model "gpt-5.6-sol:high"
herdr agent start <name> --kind cursor --pane <pane-id> -- --model cursor-grok-4.6-high
```

Ox Alpha has no herdr kind yet (`--kind opencode` is the *older* client). Drive it with pane primitives instead — `herdr pane run <pane-id> 'opencode2 mini --model opencode/x-preview-f-free'`, then `pane send-text` / `send-keys enter` / poll `pane get`. Works, but no registered name, so `agent prompt --wait` can't address it.

Model notes:

- `:high` is the worker ceiling. xhigh buys little on a well-scoped brief and costs real time; on flash it loops.
- **Don't reach for Anthropic models from inside pi.** A pi worker wanting a cheap model picks deepseek flash or luna, not haiku. Anthropic capacity is for `claude` workers. Violating it returns a 402 that reads exactly like a real out-of-credits blocker.
- Flash via OpenRouter can die mid-turn with `Error: Provider finish_reason: error`. The session survives — prompt "continue, that was a transient provider error". Recurring on the same task means move to pro.
- Flash spirals instead of asking when a brief secretly requires a design pass (state machines, commit flow). Re-slice to one module, or send it up the ladder.
- An invalid `model:level` string does not error — pi warns `Model ... not found for provider` and falls through with thinking off. Check the statusline after start.

## 2. Brief

Size an ask so its result can be reviewed and shipped in one sitting, and a drifted worker loses one increment rather than a day. Too big when: the brief needs many unrelated scope bullets, it spans surfaces that deploy separately, or you can't name what you'd deploy when it lands. Split before briefing, not after the worker drowns.

Long or reusable briefs go in a file (`brief-<task>.md`, prompt with the path plus "follow it exactly"); a two-line ask is just a prompt. Either way the brief is yours to write — it encodes design decisions, so it's big-model work. A first-look worker's findings are input to it, not a draft of it.

Substance belongs in the tracked task (what/why/done-when/evidence), so any agent can pick it up cold. The brief carries this run's mechanics: fileset, report shape, whichever rules below apply.

**The working copy is shared.** Two workers in the same files will fight, and you won't notice until a commit lands with someone else's half-finished edit. `jj status` and `jj diff -r @- --stat` show you who's where. A worker can't see other panes, so name the off-limits files in the brief: "do not edit X, Y, Z — another worker owns them; if your change genuinely requires one, stop and ask." Near-misses count — a worker owning a shared layout collides with any later "add a banner" — and the human edits in panes too.

Failure modes worth a line in the brief when they apply:

- **Reports get read from the pane.** A compact end-of-turn report (≤40 lines) is the deliverable. Asking a worker to *commit* a report deadlocks it where `tmp/` is gitignored — `jj commit -- <report>` silently drops the file. Long output (measurements, inventories) is the case for writing a file you read from disk.
- **Workers write like patent lawyers**, and reports get relayed to the human. Ask for plain language — short sentences, no jargon where a plain word exists. `/arbe-bro` is the register.
- **A test can synthesize its own input and prove nothing.** When a fix keys on a field from another service, require a `file:line` citation of the *producing* code. A worker once fixed a handler against `payload.error` where the producer emits `payload.kind`, wrote a test inventing that shape, and shipped green.
- **Workers guess at ownership and vocabulary** unless told. Who owns gated actions ("write the migration, do NOT push"), and the exact enums they'll write ("close with `closed`; `in_review` does not exist").
- **jj**: point at `arbe-jj-jujutsu` and make it binding. Delegation-specific: commit only your own files, don't reshape history, report it instead if history looks like it needs repair.
- **A blocker sends workers routing around it** — dead key, dead dev server, missing auth. Ask for one line of `blocked` and a stop. Same for your own fences: a scope rule that blocks the right fix should be reported, not detoured around.
- **pi subagents route independently of their parent** and die on OpenRouter 402s or expired Anthropic OAuth, surfacing as a fake blocker. For code reading or editing, tell the worker to use its own model and not fan out.

**A worker has no channel but its own pane**, and one that doesn't know this goes hunting for a thread or CLI to ask its question. Worth stating verbatim:

> To ask the orchestrator anything or report a blocker: stop, print one final line starting with `ORCHESTRATOR: <question or blocker>`, and end your turn. Your settled pane IS the message — it is read promptly. Do not look for another channel; do not work around the question.

## 3. Watch and steer

`herdr agent list` when you regain control; a settled pane is a finished report waiting to be read.

- **A settled Claude Code pane's composer may hold ghost text nobody typed** — a suggested next message in the human's voice, following naturally from the worker's last output, reading exactly like an answer to the question you were about to ask. `send-keys <name> esc` clears it; the only real answer comes from your own conversation with the human.
- **Deep-in-the-weeds workers respond to a checkpoint.** esc, then ask them to pause without resuming and restate in ~15 lines: goal in one sentence, design as bullets, files touched, anything added that isn't strictly needed. Costs a turn, catches drift and gold-plating before code lands, surfaces design questions they were sitting on. Follow with an explicit go.
- **"Can it be simpler — reread your diff and cut anything not needed for the goal"** reliably shrinks diffs. Cheap to send before the commit.
- **`STEERING:` mid-flight** reshapes scope without losing work. Follow-ups as separate prompts rather than one omnibus brief.
- **The human steers panes directly too** — "approved mid-session" in a report can be real input you never saw.

## 4. Review

This is what makes a cheap implementer safe, so it's the half not to skip: a strong model reviews every non-trivial diff, and never the one that wrote it. Review design and compactness, not just correctness — ask for cleaner rework instead of accepting sprawl. If a worker spins or stays weak, escalate the implementer rather than re-briefing endlessly.

- **"Checks pass" is not evidence** — ask for the pasted output. Workers report from memory of an earlier run, or from a scoped check run before their last edits. On a shared working copy one red commit blocks everyone, and whoever broke it is usually idle by the time it's noticed. The shape that causes it: a change adding a variant to a union that updates the producer but not every consumer. Name the consumers in the brief when you can see them.
- **A regex over source is evidence of nothing.** A hand-rolled "unused import" scan once deleted a live import used at 11 spread sites (`.makeSignalBase(...)` — the leading dot defeated its lookbehind) and would have 502'd every request. Use the language's own tooling, or brief a worker to.
- **A fix's own test suite can encode the bug as intended behavior**, so re-running tests can't catch it. Verify fixes with a fresh pane and a stronger model, against the original review's attack scenarios.
- **Your context is for taste, not code-reading.** Reading modules to prep a brief, tracing a flow, line-verifying a diff — all delegable. Keep the conclusion, not the files.

## 5. Reset between tasks

A long-lived worker accumulates context and starts re-litigating old decisions and rabbit-holing.

```sh
herdr agent prompt <name> "/new" --wait --timeout 15000
```

Against a self-contained brief warm context buys nothing and costs drift — including attachment to a design you just told it to abandon, which is why a REDESIGN verdict is worth a reset. Warm is right when the next task continues the same material, like reviewing fixes on its own diff.

- **Context ceiling:** pi workers get noticeably worse past ~200–250k tokens (statusline `X%/272k`). Near it, `/new` plus a fresh brief beats steering the warm session — a round-2 prompt inherits the degradation.
- **Drift looks like** the worker abandoning its brief to chase side questions it wasn't asked. Prompt an exit: "stop investigating, post your report now with what you verified, then you are done." Anything real it surfaced is yours to chase in fresh context, not its.
- `/new` returns `agent_prompt_stalled` — slash commands complete instantly, so herdr sees no state change. Confirm with `agent read`.
- `/new` resets pi's thinking level to the agent's start args.

## Gotchas

- **Always target `pane split` with `--current`** (or an explicit `$HERDR_PANE_ID`). With no target herdr splits the UI-focused pane, which may belong to the human or another client.
- **Address agents ONLY by registered name, never a pane id.** Retrying a failed `agent prompt` with a pane id once delivered the text to the orchestrator's OWN session *and* other workers' panes. If the target isn't in `agent list`, you can't reach it — relay through the human.
- **Always pass a distinct `<name>` to `agent start`.** Several panes named `claude` make every agent-addressed command ambiguous, and the pane-addressed fallback is unreliable — `pane send-keys <pane> enter` returns `ok` and sometimes doesn't submit.
- **`--wait` timeout ≠ stuck.** Exits 1 with `{"error":{"code":"timeout"}}` but the worker is usually still working. Do not re-prompt — poll `agent get` until `agent_status` leaves `working`.
- **`agent_pane_busy` right after `pane split`** means the shell hasn't spawned yet. Wait ~5–10s and retry once; still refusing is a dud pane — close it and split fresh. To relocate a live worker afterwards: `herdr pane move <pane-id> --tab <tab-id> --split right --target-pane <sibling>`. `pane move` never disturbs the agent but silently no-ops on a zoomed tab (`changed:false, reason:"zoomed_tab"`) — `pane zoom <pane-id> --off` first.
- **`--source recent-unwrapped` can return empty for pi panes**; `visible` works.
- **`Codex error: The usage limit has been reached`** doesn't look like a failure — the worker settles as `done` ~15s after briefing, having done nothing. A fast `done` on a big slice is the tell. Rebuild the pane with a different `--model` and tell the human their sub quota is out.
- **Past ~5 panes in a tab, `agent read` stops working** — panes go ~15 columns wide and reports wrap into confetti. Read the transcript from disk instead:
  ```sh
  # Claude Code: ~/.claude/projects/<slug>/<uuid>.jsonl
  jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text' <f> | tail -60
  # pi: ~/.pi/agent/sessions/<slug>/<ts>_<uuid>.jsonl — records nest one level deeper
  jq -r 'select(.type=="message" and .message.role=="assistant") | (.message.content[]? | select(.type=="text") | .text)' <f> | tail -60
  ```
  A top-level `.role`/`.content` filter silently returns nothing on a pi session, which reads as "no report" when the report is right there.
- **A prompt sent while pi is self-compacting is silently eaten.** If `agent_status` never leaves idle, read the pane and re-send. "Queued message for after compaction" fires on its own — don't re-send, and don't `esc` a compaction near the finish line.
- **Switching a pi model mid-session** is unreliable: `/model` opens a picker and leaves it open, and the full `id:level` string matches nothing there. Recipe: `/model <short-filter>` (e.g. `v4-pro`), read the pane, `send-keys enter`, confirm the statusline. If the model matters, rebuild the pane with the right start args instead. Claude Code takes `/model opus` directly.

---

Living doc. Fold what you learn about steering workers back in here.
