---
name: arbe-delegate
description: Delegate work to agent panes via herdr — spawn a pane, start an agent of any kind, brief it, read the result, steer or stop it. Same commands whether you orchestrate from Claude Code, pi, or Codex. Requires HERDR_ENV=1. Use for parallelizable or throwaway work you don't want in your own context. To decide *what* to hand off and in what order, see arbe-orchestrate.
---

# Delegate

Hand work to another agent running in a herdr pane. Use when the work is parallelizable legwork — implementation or research you'd otherwise do yourself — that should run in someone else's context.

**herdr doesn't care who you are, or who the worker is.** It's a binary in `PATH` plus `HERDR_ENV=1`, so the orchestrator can be Claude Code, pi, Codex, or anything else, and `--kind` picks the worker independently:

```
kinds: pi|claude|codex|gemini|cursor|devin|agy|cline|omp|mastracode|opencode|
       copilot|kimi|kiro|droid|amp|grok|hermes|kilo|qodercli|maki
```

Every command below is identical regardless of both ends. `herdr --skill` prints the full CLI guide; this is the delegation fast path.

**Precondition:** `test "${HERDR_ENV:-}" = 1` — only drive herdr from inside a herdr pane.

**Don't delegate when** the task is a single file edit you already understand, needs context only you hold, or is faster to do than to brief. Spawning a worker costs a pane, a briefing, and a read-back.

## Lifecycle

1. **Spawn a pane** (JSON on stdout; grab `.result.pane.pane_id`):
   ```sh
   herdr pane split --current --direction right --cwd "$PWD"
   ```
   **Never pass `--no-focus`** — the shell spawns lazily on render, and an unrendered `--no-focus` pane never becomes an "available shell", so every later `agent start` fails `agent_pane_busy` (root-caused 2026-08-14).
   ```sh
   ```
2. **Start the worker** — see [Choosing a worker](#choosing-a-worker). Returns when the agent is ready for input. Args after `--` are native args for that agent. Names are unique, `[a-z][a-z0-9_-]{0,31}`:
   ```sh
   herdr agent start <name> --kind <kind> --pane <pane-id> -- <agent-args...>
   ```
3. **Brief it** — atomically submits text+Enter and blocks until the agent settles to idle/done/blocked. No sleep-and-poll. See [Briefing](#briefing):
   ```sh
   herdr agent prompt <name> "task text" --wait --timeout 120000
   ```
4. **Read the result:**
   ```sh
   herdr agent read <name> --source visible --lines 40
   ```
   For long output, have the worker write a file and read the file instead.
5. **Reset between tasks** — wipe the session before the next brief. See [Keeping a worker sane](#keeping-a-worker-sane):
   ```sh
   herdr agent prompt <name> "/new" --wait --timeout 15000
   ```
6. **Steer / interrupt** — `esc` interrupts mid-turn (state returns to idle), then prompt again:
   ```sh
   herdr agent send-keys <name> esc
   ```
7. **Status** — JSON with `agent_status`: idle/working/blocked/done/unknown. `blocked` = the agent is showing an approval or question UI; read the pane before deciding:
   ```sh
   herdr agent get <name>    # or: herdr agent list
   ```
8. **Reorganize** — `herdr pane move <pane-id> --tab <tab-id> --split right|down` relocates a live pane without disturbing its agent. Gotcha: it silently no-ops (`changed:false, reason:"zoomed_tab"`) while the source tab is zoomed — `herdr pane zoom <pane-id> --off` first, then move.
9. **Cleanup** — only close panes you created:
   ```sh
   herdr pane close <pane-id>
   ```

## Choosing a worker

Kind first, model second.

- **Need an Anthropic model? `--kind claude`.** Claude Code runs on the Claude subscription — free at the margin.
  ```sh
  herdr agent start <name> --kind claude --pane <pane-id>
  ```
- **Anything else? `--kind pi`.** pi holds the OpenRouter key (so: every model) *and* the ChatGPT subscription.

### pi model + thinking

`--model "provider-model-id:<thinking-level>"` — the `:suffix` sets thinking effort.

- **Default: `gpt-5.6-sol:medium` or `:high`** with `--provider openai-codex`. Great on the more challenging things, and it goes through the ChatGPT subscription inside pi — free while the sub quota lasts. Never use the `openai/...`-prefixed variant; that routes via OpenRouter and burns paid tokens for the same model.
  ```sh
  herdr agent start <name> --kind pi --pane <pane-id> -- \
    --provider openai-codex --model "gpt-5.6-sol:high"
  ```
- **Sub quota exhausted → `deepseek/deepseek-v4-flash-0731:high`** via `--provider openrouter`. Paid, but so cheap it barely registers, and very strong for the price. Prefer `:high` over `:xhigh` — xhigh tends to spin ideas in loops on flash. A pane already stuck on xhigh is fine to use; don't fight the picker over it.
- `deepseek/deepseek-v4-pro-0813:high` — stronger, pricier; reserve for tasks flash keeps failing.

**GOTCHA:** an invalid `model:level` string does NOT error — pi warns `Model ... not found for provider` and falls through to a custom model id with thinking off. Check for that warning line (or the statusline showing model + thinking state) after start.

**Session persistence (pi):** default (no flag) persists the worker's session under `~/.pi/agent/sessions/<project>/` for later inspection — keep that for real work. Add `--no-session` only for throwaway probes.

## Review gate

Model strength ladder: **gpt-5.6-sol > Opus 5 > deepseek**. The house power combo is deliberately **deepseek worker + big-model review**: cheap strong implementation with an Opus 5 / Sonnet 5 agent reviewing every non-trivial diff before it ships/deploys; small diffs the orchestrator reviews personally. Review design and compactness, not just correctness — demand cleaner/compacter rework from the worker rather than accepting sprawl. If a worker spins or its output is repeatedly weak, escalate up the ladder instead of re-briefing endlessly — usually to **Opus 5 via `--kind claude`** (free on the Claude subscription; good fit for log-tracing/timing analysis), reserving sol for the hardest work since the ChatGPT sub quota is limited.

## Working together (orchestrator ⇄ workers ⇄ human)

Patterns proven in practice (arbe, 2026-08-14):

- **Brief via file, not prompt.** Write the brief to a scratchpad file (`brief-<task>.md`) and prompt the worker with just the path plus "follow it exactly, including the binding rules". Briefs stay reviewable and reusable across resets; prompts stay atomic. The binding rules (blockers, jj fileset, report path) live in the brief itself.
- **Task carries the substance, brief carries the run mechanics.** Put what/why/done-when/evidence in the tracked task so any agent can pick it up cold; the brief holds only this run's mechanics — commit fileset, report path, rules reminder (which must be in the brief; abstract rules don't stop mid-task spirals), and anything that must not enter the durable record (secret file paths). A well-written task shrinks the brief to a few lines.
- **Reports are files, committed.** The worker writes `tmp/worker-reports/<task>.md` and includes it in its commit fileset, plus a one-line result to the team inbox thread. The orchestrator reviews the report and the diff, not pane scrollback.
- **Tracked tasks are the shared ledger.** Claim before work (`--status in_progress`); scope cuts and evidence go into the task body (update via `--stdin` JSON) so any fresh agent can pick the task up cold; close with what shipped (version id, deploy) in the reason.
- **Fresh worker per task is the default.** Self-contained briefs backed by committed docs/reports make warm context unnecessary — a fresh agent reads the same material. Reuse a warm worker only when the next task literally continues its material (e.g. reviewing its own diff).
- **Deliver in deployable increments.** Brief for one commit per working increment (smallest working slice → commit → one-line note → next); the orchestrator deploys/probes behind each commit. A mid-flight `STEERING:` prompt reshapes delivery or scope without losing work — workers absorb it like a user typing into their session, and both scope cuts and extensions land cleanly this way.
- **The human talks to panes too.** The human may steer or approve directly inside a worker pane; a worker report saying "approved mid-session" can be genuine input you never saw. Read the pane and report before assuming state, and reconcile whatever happened back into the task body.
- **Poll when you regain control.** `herdr agent list` first thing whenever you return from other work — an idle worker is a finished report waiting for review. Don't let finished work sit while you do side quests.

## Briefing

**jj in briefs:** a worker may run exactly one mutating jj command: `jj commit -- <its own files>` when done. Forbid squash/amend/restore/abandon/new in the brief — the working copy is shared, and a confused worker doing "history repair" (observed 2026-08-14: `jj squash` folded its finished commit into @, jumbling three agents' files) costs the orchestrator a manual split. If a worker thinks history needs reshaping, it reports that and stops.

Workers inherit the project's AGENTS.md, but abstract rules don't stop a mid-task spiral — put the failure-mode reminder in the brief itself when the task touches infra: on any blocker (out-of-credits key, dead dev server, missing auth) report `blocked` in one line and stop; no workarounds. (Observed: a worker spent ~2.6M read tokens routing around a 402 instead. The concrete arbe blocker list lives in arbe's AGENTS.md "STOP at blockers".)

Answer a worker's decision points explicitly. If one seems stuck mid-task, read the pane — a short clarifying nudge often unsticks it.

## Keeping a worker sane

A long-lived worker accumulates context and starts spinning in circles — re-litigating old decisions, rabbit-holing. After a task's report is in, reset before the next brief.

- **Context ceiling (Oskar, 2026-08-14):** pi workers "get stupid" past ~200–250k tokens — watch the statusline (`X%/272k`). Approaching ~200k mid-task, reset, compact, or rescope rather than pushing on. Split long design/research sessions into stages with fresh context per stage.
- **What drift looks like** (observed at 532k): the worker abandons its brief and investigates side questions it wasn't asked — source-diving to explain an anomaly instead of reporting it. Don't let it run. Prompt an explicit exit: *"stop investigating, post your report now with what you verified, then you are done."* A real finding it surfaced is yours to chase in fresh context, not its.
- **Reuse a warm (un-reset) worker** only when the next task genuinely continues the same context — e.g. reviewing fixes on its own diff.

`/new` confirmation: expect an `agent_prompt_stalled` error — slash commands complete instantly, so herdr sees no state change. Confirm with `agent read` ("✓ New session started", context back to 0.0%).

## Gotchas

- **`--wait` timeout ≠ stuck.** On timeout it exits 1 with `{"error":{"code":"timeout"}}`, but the worker is usually still working. Do NOT re-prompt — that interrupts or queues a second task. Poll `herdr agent get <name>` until `agent_status` leaves `working`, then read the pane. Size `--timeout` generously for tasks with live waits or measurements.
- **`agent_pane_busy` right after `pane split`** ("not an available shell") — the shell hasn't spawned yet: wait ~5–10s and retry once. Still refusing = dud pane (seen with very short panes in a crowded tab): `pane close` it and split a fresh one. Nudging with `pane run "true"` is not the fix and can't wake a shell-less pane. Don't swallow `agent start` stderr. **Splitting into a background (non-focused) tab produces persistent refusals** even when the pane visibly runs a shell (observed 3/3 panes, 2026-08-14) — the reliable recipe is: `pane split --current` (focused tab), `agent start` there, then `pane move <id> --tab <target> --split right|down --target-pane <sibling>` to relocate the live worker. `pane move` never disturbs the agent.
- **`pane move` silently no-ops while the source tab is zoomed** (`changed:false, reason:"zoomed_tab"`) — `herdr pane zoom <pane-id> --off` first, then `herdr pane move <pane-id> --tab <tab-id> --split right|down` relocates a live pane without disturbing its agent.
- **`--source recent-unwrapped` can return empty** for pi panes; `visible` works.
- **A prompt sent while pi is self-compacting is silently eaten** — the call returns but the worker stays idle with no state change. If `agent_status` never leaves idle, read the pane; if compaction just finished, re-send. Sometimes the pane instead shows "Queued message for after compaction" — then it will fire on its own; don't re-send, and don't `esc` a compaction near the finish line (cancelling wastes the whole pass — read the pane before interrupting).
- **Claude Code workers take `/model opus` directly** — the argument applies without opening a picker (unlike pi's `/model`); confirm via the banner/statusline before briefing.
- **`/new` resets pi's thinking level to the agent's *start args*.** If the pane started at a different level than you want now, follow with `herdr agent prompt <name> "/model <id:level>"` and confirm the statusline.
- **`/model <id:level>` leaves pi's model picker OPEN.** The next prompt gets typed into the picker's fuzzy filter and silently does nothing — the worker never starts and `--wait` settles as if done. After any `/model`, send `herdr agent send-keys <name> esc`, then verify the worker actually reached `working` after briefing.

## Herdr is mandatory — no headless fallback

Oskar (2026-08-14): workers **must** run in herdr panes — visibility, steering, a place to nudge. Do not fall back to headless `pi -p` when panes misbehave; the pane failures have fixes above (no `--no-focus`, wait-then-retry, replace dud panes). If herdr breaks in a genuinely new way, stop and surface it instead of going headless. To learn more herdr than this doc covers, `herdr --skill` prints the full CLI guide — or have a cheap subagent digest it.
