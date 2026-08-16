---
name: arbe-delegate
description: Delegate work to agent panes via herdr — spawn a pane, start an agent of any kind, brief it, read the result, steer or stop it. Same commands whether you orchestrate from Claude Code, pi, or Codex. Requires HERDR_ENV=1. Use for parallelizable or throwaway work you don't want in your own context. To decide *what* to hand off and in what order, see arbe-orchestrate.
---

# Delegate

Hand work to another agent running in a herdr pane — parallelizable legwork, implementation or research that should run in someone else's context.

herdr doesn't care who you are or who the worker is. It's a binary in `PATH` plus `HERDR_ENV=1`. The orchestrator can be Claude Code, pi, Codex, or anything else, and `--kind` picks the worker. Every command here is the same regardless of both ends.

```
kinds: pi|claude|codex|gemini|cursor|devin|agy|cline|omp|mastracode|opencode|
       copilot|kimi|kiro|droid|amp|grok|hermes|kilo|qodercli|maki
```

Precondition: `test "${HERDR_ENV:-}" = 1` — only drive herdr from inside a herdr pane. Workers run in panes, never headless `pi -p` (Oskar, 2026-08-14): visibility, steering, a place to nudge. Every pane failure below has a fix; if herdr breaks in a genuinely new way, stop and surface it.

Don't delegate a single file edit you already understand, work needing context only you hold, or anything faster to do than to brief. A worker costs a pane, a briefing, and a read-back.

Two modes, ending differently:

- **Delegate and return** — start, brief, wait, read. The default, and the whole arc below. Done when you have the response, or when a `blocked` worker has been inspected and its question relayed.
- **Launch and hand off** — start the agent, stop after step 2, report its name and pane ID to the human, leave the conversation to them.

Sections follow the run: **pick → start → brief → watch → review → reset**, then gotchas. `herdr --skill` prints the full CLI guide; this is the delegation fast path.

## 1. Pick a worker

Kind first, model second. Strength ladder: **gpt-5.6-sol > Opus 5 > deepseek**.

Need an Anthropic model? `--kind claude`. Claude Code runs on the Claude subscription — free at the margin, good at log-tracing and timing analysis.

```sh
herdr agent start <name> --kind claude --pane <pane-id>
```

Anything else? `--kind pi`, which holds the OpenRouter key (so: every model) and the ChatGPT subscription. `--model "provider-model-id:<thinking-level>"`, where the suffix sets thinking effort:

```sh
herdr agent start <name> --kind pi --pane <pane-id> -- \
  --provider openai-codex --model "gpt-5.6-sol:high"
```

| model | pick it for |
| --- | --- |
| `deepseek/deepseek-v4-flash-0731:high` (`--provider openrouter`) | well-specified legwork on a tight brief — renames, ports, single-module features, proof/test runs. Paid, but very cheap and strong for the price. |
| `deepseek/deepseek-v4-pro-0813:high` | briefs flash has failed twice. Stronger, pricier. |
| `gpt-5.6-sol:medium` (`--provider openai-codex`) | the workhorse — very stable, right for most implementation briefs, and for anything spanning layers. |
| `gpt-5.6-sol:high` | the hardest, highest-trust work only: cross-layer changes, subtle concurrency, a diff you'd otherwise review line-by-line. |

sol is free on the ChatGPT sub while the quota lasts, but the quota is shared — that's what pushes routine legwork down to deepseek, not price alone. Never use the `openai/...` variant of sol; it routes via OpenRouter and burns paid tokens for the same model.

- Prefer flash at `:high` over `:xhigh` — xhigh loops on flash. A pane already stuck on xhigh is fine to use; don't fight the picker.
- Flash via OpenRouter dies mid-turn with `Error: Provider finish_reason: error` during long thinking (4x in one session, 2026-08-15). The session survives: prompt "continue, that was a transient provider error". If it recurs on the same task, move the pane to pro.
- Flash's real failure mode (2026-08-15): a brief that silently requires restructuring a state machine (batching seam calls forced a cell commit-flow redesign) sends it into a reasoning spiral instead of an `ORCHESTRATOR:` question — it won't recognize "this needs a design pass" on its own. If a brief crosses into state or commit-flow territory, re-slice so the worker stays in one module, or send it up the ladder. Watching the pane's reasoning for spirals is part of the review loop.
- An invalid `model:level` string does not error. pi warns `Model ... not found for provider` and falls through to a custom model id with thinking off. Check for that line or the statusline after start.
- pi sessions persist under `~/.pi/agent/sessions/<project>/` for later inspection. Keep that for real work; add `--no-session` only for throwaway probes.

## 2. Spawn, start, brief, read

1. Spawn a pane. JSON on stdout; grab `.result.pane.pane_id`:
   ```sh
   herdr pane split --current --direction right --cwd "$PWD"
   ```
   Never pass `--no-focus`. Those panes go persistently `agent_pane_busy`, even in your own focused tab, and no nudge or retry clears it. Close the pane and re-split without the flag; that works first try. `herdr --skill` tells you to use `--no-focus` for background work — it's wrong here; this rule wins.

   Keep `--current` (or an explicit `$HERDR_PANE_ID`). With no target, herdr splits the UI-focused pane, which may belong to the human or another client. Your own context is in `$HERDR_WORKSPACE_ID`, `$HERDR_TAB_ID`, `$HERDR_PANE_ID`.
2. Start the worker. Returns when the agent is ready for input. Args after `--` go to the agent. Names are unique, `[a-z][a-z0-9_-]{0,31}`:
   ```sh
   herdr agent start <name> --kind <kind> --pane <pane-id> -- <agent-args...>
   ```
3. Brief it. Submits text plus Enter and blocks until the agent settles to idle/done/blocked. No sleep-and-poll:
   ```sh
   herdr agent prompt <name> "task text" --wait --timeout 120000
   ```
4. Read the result:
   ```sh
   herdr agent read <name> --source visible --lines 40
   ```
   For long output, have the worker write a file and read the file. This isn't a style rule: agents draw on the terminal's alternate screen, and rows that scroll off it never enter herdr's host scrollback — so if raising `--lines` reveals nothing more, the text is gone and no read can recover it.
5. Cleanup. Only close panes you created:
   ```sh
   herdr pane close <pane-id>
   ```

## 3. Brief

Scope one ask small. Asks routinely balloon to 15–30 minutes of worker time; the default should be one mechanism, one commit, one report — about 5–10 minutes. Split the rest into follow-up prompts. A genuinely deep task may deserve a long ask, but that's the exception.

Deliver in deployable increments. Size an ask so its result can be reviewed and shipped in one sitting, and so a failed or drifted worker loses one increment, not a day — 10 minutes or a few hours; duration isn't the test, independence is. The orchestrator deploys and probes behind each commit. Smell test for too-big: the brief needs many unrelated scope bullets, spans surfaces that deploy separately, or you can't name what you'd deploy when it lands. Split before briefing, not after the worker drowns.

- **Brief via file, not prompt.** Write it to `brief-<task>.md` and prompt the worker with the path plus "follow it exactly, including the binding rules". Briefs stay reviewable and reusable across resets; prompts stay atomic.
- **Draft the brief personally** (Oskar, 2026-08-15). A first-look worker's report is input — its scope questions and findings feed the brief — but the brief text is big-model work: it encodes the design decisions, and a cheap worker's draft needs the same review effort as writing it fresh. Don't delegate brief-drafting down the ladder.
- **The task carries the substance, the brief carries the run mechanics.** What/why/done-when/evidence live in the tracked task so any agent can pick it up cold. The brief holds this run's mechanics: commit fileset, report path, rules reminder, anything that must stay out of the durable record. A good task shrinks the brief to a few lines.
- **Reports are files, committed.** The worker writes `tmp/worker-reports/<task>.md`, includes it in its commit fileset, and posts a one-line result to the team inbox. Review the report and the diff, not pane scrollback.
- **Tracked tasks are the shared ledger.** Claim before work (`--status in_progress`). Put scope cuts and evidence in the task body (update via `--stdin` JSON). Close with what shipped in the reason.
- **Spell out ownership and vocabulary.** Workers follow both perfectly when told and trip when not: who owns gated actions ("write the migration, do NOT push — the orchestrator is classifier-gated"), and the exact enums they'll write ("close with `closed`; `in_review` does not exist"). Answer their decision points explicitly.
- **jj rules.** A worker may run exactly one mutating jj command, `jj commit -- <its own files>`, when done. Forbid squash/amend/restore/abandon/new in the brief. The working copy is shared; a confused worker doing "history repair" once folded its commit into @ and jumbled three agents' files. A worker that thinks history needs reshaping reports that and stops.
- **Restate the blocker rule.** Workers inherit the project's AGENTS.md, but abstract rules don't stop a mid-task spiral. When the task touches infra, put it in the brief: on any blocker (out-of-credits key, dead dev server, missing auth), report `blocked` in one line and stop, no workarounds. One worker once spent ~2.6M read tokens routing around a 402. The concrete arbe list lives in arbe's AGENTS.md "STOP at blockers".

**Give the worker a return channel — every time.** A worker has no way to "message the orchestrator"; its only channel is its own pane, read when it settles. Workers that don't know this go looking (2026-08-15: a blocked worker hunted for a thread/CLI channel to ask its question). Put this contract in every brief:

> To ask the orchestrator anything or report a blocker: stop, print one final line starting with `ORCHESTRATOR: <question or blocker>`, and end your turn. Your settled pane IS the message — it is read promptly. Do not look for another channel; do not work around the question.

## 4. Watch and steer

Poll `herdr agent list` whenever you regain control, and read a settled pane's tail before anything else. An idle worker is a finished report waiting for review.

```sh
herdr agent get <name> | jq -r .result.agent.agent_status
herdr agent list | jq -r '.result.agents[] | "\(.name // .agent)\t\(.agent_status)"'
```

`agent_status` is idle/working/blocked/done/unknown — pipe herdr's JSON through `jq`, not ad-hoc python. `blocked` means the agent shows an approval or question UI; read the pane before deciding. `done` is the same underlying idle state as `idle`, for work that finished while its tab was unseen — and CLI reads don't mark a tab seen, only focusing it does, so a worker you only ever poll settles as `done`, not `idle`. `unknown` means herdr sees an agent but can't classify it; it is not evidence the work finished — read the pane.

Interrupt with `esc`; it returns the state to idle, then prompt again:

```sh
herdr agent send-keys <name> esc
```

- **The pause-and-restate checkpoint** (proven 2026-08-15). When a worker looks deep in the weeds — or the human asks "are they on track?" — `send-keys esc`, then prompt: *"PAUSE — checkpoint, do not resume. In under 15 lines restate: (1) goal in one sentence; (2) design as bullets; (3) files touched so far; (4) anything added that is NOT strictly needed. Then stop and wait for my go."* Costs one turn, catches drift and gold-plating before any code lands, and surfaces blocked design questions the worker was sitting on. Follow with an explicit `GO` plus corrections — workers hold cleanly.
- **Ask "can it be simpler?" before the commit.** Once a worker has worked a while or reports ready: *"can it be simpler? reread your diff and cut anything not needed for the goal."* Sounds trivial; reliably shrinks diffs (Oskar, 2026-08-15 — a fad3 worker used it to probe-and-revert a speculative extra fix instead of shipping it). Cheap to send with the nudge loop.
- **`STEERING:` mid-flight.** A prompt prefixed that way reshapes scope or delivery without losing work; workers absorb it like a user typing into their session. Send follow-ups as separate prompts, never as an omnibus brief.
- **The human talks to panes too.** They may steer or approve inside a worker pane directly, so "approved mid-session" in a report can be genuine input you never saw. Read the pane and report before assuming state, and reconcile what happened into the task body.

## 5. Review gate

The house combo is a deepseek worker plus big-model review: cheap strong implementation, with an Opus 5 / Sonnet 5 agent reviewing every non-trivial diff before it ships. Small diffs the orchestrator reviews personally. Review design and compactness, not just correctness; ask for cleaner rework instead of accepting sprawl. If a worker spins or stays weak, escalate up the ladder instead of re-briefing endlessly — usually to Opus 5 via `--kind claude`.

Re-review fixes independently. After workers fix review findings, spawn a fresh pane with a stronger model and brief it to verify each fix against the original review's attack scenarios. This once caught a regression the implementer and the orchestrator's own diff review both missed: the fix's test suite encoded the bug as intended behavior, so running tests could never surface it. A different reviewer beats re-running tests.

## 6. Reset between tasks

A long-lived worker accumulates context and starts spinning in circles: re-litigating old decisions, rabbit-holing. After a task's report is in, wipe the session before the next brief:

```sh
herdr agent prompt <name> "/new" --wait --timeout 15000
```

- **Fresh worker per task.** Self-contained briefs plus committed reports make warm context unnecessary; a fresh agent reads the same material. Reuse a warm worker only when the next task continues its material, like reviewing fixes on its own diff.
- **Context ceiling** (Oskar, 2026-08-14): pi workers get stupid past ~200–250k tokens. Watch the statusline (`X%/272k`). Near ~200k mid-task, reset, compact, or rescope rather than pushing on. Split long design or research sessions into stages with fresh context per stage.
- **What drift looks like** (seen at 532k): the worker abandons its brief and chases side questions it wasn't asked, like source-diving to explain an anomaly instead of reporting it. Prompt an explicit exit: "stop investigating, post your report now with what you verified, then you are done." A real finding it surfaced is yours to chase in fresh context, not its.
- `/new` returns an `agent_prompt_stalled` error — slash commands complete instantly, so herdr sees no state change. Confirm with `agent read` ("✓ New session started", context back to 0.0%).
- `/new` also resets pi's thinking level to the agent's start args. If the pane started at a different level than you want now, follow with `/model` (see gotchas) and confirm the statusline.

## Gotchas

- **`--wait` timeout ≠ stuck.** On timeout it exits 1 with `{"error":{"code":"timeout"}}`, but the worker is usually still working. Do not re-prompt; that interrupts or queues a second task. Poll `herdr agent get <name>` until `agent_status` leaves `working`, then read the pane. Size `--timeout` generously for tasks with live waits or measurements.
- **`agent_pane_busy` right after `pane split`** ("not an available shell"): the shell hasn't spawned yet. Wait ~5–10s and retry once. Still refusing means a dud pane; close it and split fresh. `pane run "true"` can't wake a shell-less pane, and don't swallow `agent start` stderr. Persistent refusals track `--no-focus` (step 1). Reliable recipe: split focused, start the agent, then relocate the live worker with `herdr pane move <pane-id> --tab <tab-id> --split right|down --target-pane <sibling>`. `pane move` never disturbs the agent, but it silently no-ops (`changed:false, reason:"zoomed_tab"`) while the source tab is zoomed — `herdr pane zoom <pane-id> --off` first.
- **`--source recent-unwrapped` can return empty for pi panes**; `visible` works.
- **A prompt sent while pi is self-compacting is silently eaten.** The call returns but the worker stays idle. If `agent_status` never leaves idle, read the pane and re-send if compaction just finished. If the pane shows "Queued message for after compaction", it will fire on its own — don't re-send. Don't `esc` a compaction near the finish line; cancelling wastes the whole pass.
- **A pi worker on `--provider openai-codex` still fans its own subagents out via OpenRouter.** An OpenRouter 402 kills the worker's delegation even though its main model is fine (2026-08-15: three librarian subagents died, worker correctly reported blocked). Surface the top-up to the human, then steer the worker to read directly with its own model; code-editing briefs need no LLM fan-out anyway.
- **Switching a pi model mid-session.** `/model` opens a picker and leaves it open — the next prompt types into its fuzzy filter and does nothing, while `--wait` settles as if done. The full `id:level` string matches nothing there ("No matching models"); the `:level` suffix breaks the filter. Working recipe (2026-08-15): `/model <short-filter>` (e.g. `v4-pro`), read the pane to confirm the filtered list, `send-keys <name> enter` to take the top match, then confirm the statusline. Thinking level carries over from the pane's start args, so only the model id changes. Even then the switch can silently not take — if the model matters, rebuild the pane with the right start args instead of fighting the picker. Claude Code workers take `/model opus` directly, no picker; confirm the statusline before briefing.

---

This skill is a living doc. When you learn something about steering these workers — a model's failure mode, a better brief shape, a herdr trick — fold it in here rather than leaving it in the session.
