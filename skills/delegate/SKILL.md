---
name: arbe-delegate
description: Delegate work to agent panes via herdr — spawn a pane, start an agent of any kind, brief it, read the result, steer or stop it. Same commands whether you orchestrate from Claude Code, pi, or Codex.  Use for parallelizable or throwaway work you don't want in your own context. To decide *what* to hand off and in what order, see arbe-orchestrate.
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

Three axes, and no model wins all three: **price, speed, trust** — trust being how smart it is and therefore how much of its diff you can take on faith.

So pick per role, not per task:

- **orchestrator** — smart. That's you.
- **implementer** — the cheapest model that can hold the brief.
- **reviewer** — smart, and never the model that wrote the diff.

A smart model doing direction and review, with a cheap fast one implementing between them, beats one expensive model doing all three — cheaper, and usually better, because the reviewer reads the diff cold. That only holds while the review actually happens (§6): cheap implementation without it is just cheap. Escalate the implementer when a brief keeps failing, not by default.

Kind first, model second. The kind picks which account pays.

| account | reach it with | what it's for |
| --- | --- | --- |
| Anthropic sub | `--kind claude` | Anthropic models. Log-tracing, timing analysis, the review gate. |
| Codex sub | `--kind pi --provider openai-codex` | sol — the strongest implementer. Reach it this way, never the `openai/...` id: that routes via OpenRouter and pays per token for a model the sub already covers. |
| Cursor sub | `--kind cursor` | grok. Effort is baked into the id (`-low`/`-medium`/`-high`/`-xhigh`), not a `:suffix` like pi. **Never a `-fast` variant** (Oskar, 2026-08-18) — on grok they cost far too much for the latency they buy. Its catalogue also lists Anthropic and sol ids; ignore those. `cursor-agent models` lists everything. |
| OpenRouter credits | `--kind pi` (its default provider) | everything else, deepseek included. Paid per token. |

pi takes `--model "provider-model-id:<thinking-level>"`, where the suffix sets thinking effort.

```sh
herdr agent start <name> --kind claude --pane <pane-id>

herdr agent start <name> --kind pi --pane <pane-id> -- \
  --provider openai-codex --model "gpt-5.6-sol:high"

herdr agent start <name> --kind cursor --pane <pane-id> -- \
  --model cursor-grok-4.6-high
```

Ratings are Oskar's, from running these as workers. Price is what it costs *you*, so a subscription model reads cheap even when the same weights cost money elsewhere.

| model | price | speed | trust | use it as |
| --- | --- | --- | --- | --- |
| `deepseek/deepseek-v4-flash-0731:high` | very cheap | fast | medium | the default implementer. Well-specified legwork on a tight brief — renames, ports, single-module features, proof/test runs. |
| `deepseek/deepseek-v4-pro-0813:high` | cheap | medium | medium-high | implementer for briefs flash has failed twice. |
| `cursor-grok-4.6-high` (`--kind cursor`) | sub | fast | medium-high | implementer. `cursor-grok-4.5-high` is the older sibling. |
| `gpt-5.6-sol:medium` (Codex sub) | sub | medium | high | the workhorse implementer — very stable, right for anything spanning layers. |
| `gpt-5.6-sol:high` | sub | slow | highest | implementer for the hardest work only: cross-layer changes, subtle concurrency, a diff you'd otherwise review line-by-line. |
| Opus 5 (`--kind claude -- --model opus --effort <level>`) | sub | medium | highest | the reviewer, and the escalation target when a worker spins. `--effort xhigh` for hard implementation work — cross-layer changes, auth, a diff you'd otherwise review line by line. Claude Code takes `--model`/`--effort` as start args, applied at launch with no picker to fight. |

**Which account has headroom changes week to week, and none of it is inferable from this file — ask Oskar before assuming anything is free.** The two tables above are the only place volatile ids and accounts live; nothing below depends on today's prices.

**Don't reach for Anthropic models from inside pi** (Oskar, 2026-08-18). When a pi worker wants a cheap model — its own subagents, or a script it writes — that's deepseek flash or luna, not haiku. Anthropic capacity is for `claude` workers. A worker that ignores this gets a 402 "requires more credits" from pi's OpenRouter key, which reads exactly like a genuine out-of-credits blocker and stops it dead; recognise that shape and re-point the model instead of escalating an outage.

A worker measuring a model's latency should measure it where it already runs rather than calling the model itself — for arbe, post to a real thread and read `arbe thread trace`, which exercises arbe's own key. Prompt size can be counted offline with no API call at all.

- Prefer flash at `:high` over `:xhigh` — xhigh loops on flash. A pane already stuck on xhigh is fine to use; don't fight the picker.
- `:high` is the ceiling for workers generally, not just flash (Oskar, 2026-08-18). xhigh buys little on a well-scoped brief and costs real time. Reach past high only for a brief you'd otherwise review line-by-line.
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

## 3. Check who owns the files

The working copy is shared. Two workers briefed into the same files will fight, and you will not
notice until a commit lands with someone else's half-finished edit in it. Spend ten seconds before
every brief:

```sh
jj status                              # what is uncommitted right now, and whose it is
jj diff -r @- --stat                   # what the last worker just committed
```

Name the off-limits files in the brief itself. A worker cannot see the other panes and has no way to
discover the conflict on its own, so "do not edit X, Y, Z — another worker owns them; if your change
genuinely requires one, stop and ask" is the whole fix. Pair it with the standing rule to commit only
its own files.

Watch for the near-misses, not just the overlaps: a UI worker owning a shared layout and stylesheet
will collide with *any* later worker told to "add a banner", because that is where banners go
(2026-08-18). Human-driven panes count — the human edits in panes too, and their work is invisible to
you unless you look at the working copy.

## 4. Brief

Scope one ask small. Asks routinely balloon to 15–30 minutes of worker time; the default should be one mechanism, one commit, one report — about 5–10 minutes. Split the rest into follow-up prompts. A genuinely deep task may deserve a long ask, but that's the exception.

Deliver in deployable increments. Size an ask so its result can be reviewed and shipped in one sitting, and so a failed or drifted worker loses one increment, not a day — 10 minutes or a few hours; duration isn't the test, independence is. The orchestrator deploys and probes behind each commit. Smell test for too-big: the brief needs many unrelated scope bullets, spans surfaces that deploy separately, or you can't name what you'd deploy when it lands. Split before briefing, not after the worker drowns.

- **Brief via file, not prompt.** Write it to `brief-<task>.md` and prompt the worker with the path plus "follow it exactly, including the binding rules". Briefs stay reviewable and reusable across resets; prompts stay atomic.
- **Draft the brief personally** (Oskar, 2026-08-15). A first-look worker's report is input — its scope questions and findings feed the brief — but the brief text is big-model work: it encodes the design decisions, and a cheap worker's draft needs the same review effort as writing it fresh. Don't delegate brief-drafting down the ladder.
- **The task carries the substance, the brief carries the run mechanics.** What/why/done-when/evidence live in the tracked task so any agent can pick it up cold. The brief holds this run's mechanics: commit fileset, report path, rules reminder, anything that must stay out of the durable record. A good task shrinks the brief to a few lines.

- **Reports are untracked scratch.** The worker writes its report to a scratch path (`tmp/worker-reports/<task>.md` in arbe) and posts a one-line result to the team inbox. Review the report and the diff, not pane scrollback. Scratch dirs are usually gitignored, so **never tell a worker to name one in a commit fileset** — say in the brief that the report stays untracked, and that you will read it from disk and distil the durable version into the tracked task. If a worker's *output itself* must be tracked, give it a real path in the tree, not a scratch one.
- **Reports live in the pane, not in files** (Oskar, 2026-08-17). The worker ends its turn with a compact report (≤40 lines) in its own session; the settled pane is the deliverable, read with `agent read`. Don't have workers persist report files, and NEVER ask one to commit a report (repos that gitignore `tmp/` make `jj commit -- <report>` silently drop it — two rule-following workers once blocked on that contradiction). The alternate-screen caveat still binds: rows that scroll off the visible screen are unrecoverable, so a genuinely long result (measurements, inventories) goes to a file the orchestrator reads from disk — the exception, not the default.
- **Tracked tasks are the shared ledger.** Claim before work (`--status in_progress`). Put scope cuts and evidence in the task body (update via `--stdin` JSON). Close with what shipped in the reason.
- **Ask for plain language in the report** (Oskar, 2026-08-18). Reports get relayed to the human, and workers default to writing like they're filing a patent. One line in every brief: *"Write your report in plain language. Short sentences, one idea each, no jargon where a plain word exists. A human reads it, not just me."* The `/arbe-bro` skill is the register you want.
- **Quote the wire shape, never assume it.** When a fix keys on a field from another service — a response body, an event payload, a DB row — require the worker to cite the *producing* code with `file:line` and match it exactly. A sol:high worker once fixed a 409 handler against `payload.error` when the cell emits `payload.kind`, then wrote a test that invented the `error:` shape. The test passed, the bug shipped green, and only an adversarial reviewer reading the producer caught it. A test that synthesizes its own input proves nothing about production.
- **Spell out ownership and vocabulary.** Workers follow both perfectly when told and trip when not: who owns gated actions ("write the migration, do NOT push — the orchestrator is classifier-gated"), and the exact enums they'll write ("close with `closed`; `in_review` does not exist"). Answer their decision points explicitly.
- **jj rules.** Version control is the `arbe-jj-jujutsu` skill's business, not this one. Point the brief at it and make its rules binding — especially the mandatory `jj diff -r @- --stat` after every commit. The only delegation-specific parts: the working copy is SHARED, so a worker commits only its own files and never reshapes history (a confused worker doing "history repair" once folded its commit into @ and jumbled three agents' files). A worker that thinks history needs reshaping reports that and stops.
- **Restate the blocker rule.** Workers inherit the project's AGENTS.md, but abstract rules don't stop a mid-task spiral. When the task touches infra, put it in the brief: on any blocker (out-of-credits key, dead dev server, missing auth), report `blocked` in one line and stop, no workarounds. One worker once spent ~2.6M read tokens routing around a 402. The concrete arbe list lives in arbe's AGENTS.md "STOP at blockers". Say the same about your own fences (Oskar, 2026-08-18): tell the worker that any rule in the brief blocking the right fix is to be reported, not routed around — a scope fence that forces a detour costs more than the conflict it was avoiding.

**Give the worker a return channel — every time.** A worker has no way to "message the orchestrator"; its only channel is its own pane, read when it settles. Workers that don't know this go looking (2026-08-15: a blocked worker hunted for a thread/CLI channel to ask its question). Put this contract in every brief:

> To ask the orchestrator anything or report a blocker: stop, print one final line starting with `ORCHESTRATOR: <question or blocker>`, and end your turn. Your settled pane IS the message — it is read promptly. Do not look for another channel; do not work around the question.

## 5. Watch and steer

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

- **A settled pane's composer may already hold text that nobody typed.** Claude Code panes suggest a next user message as ghost text, written in the human's voice and following naturally from the worker's last output — so it reads exactly like the human answered a question you were about to ask. Seen four times in one session (2026-08-18): `fix the wait path too`, `ask the cell for the live permit holder`, `yes, derive it from the evidence — go ahead`. Every one was a plausible instruction; none were real. **`send-keys <name> esc` before every prompt to a settled pane**, and never read composer text as input — the only real answer comes through your own conversation with the human.
- **The pause-and-restate checkpoint** (proven 2026-08-15). When a worker looks deep in the weeds — or the human asks "are they on track?" — `send-keys esc`, then prompt: *"PAUSE — checkpoint, do not resume. In under 15 lines restate: (1) goal in one sentence; (2) design as bullets; (3) files touched so far; (4) anything added that is NOT strictly needed. Then stop and wait for my go."* Costs one turn, catches drift and gold-plating before any code lands, and surfaces blocked design questions the worker was sitting on. Follow with an explicit `GO` plus corrections — workers hold cleanly.
- **Ask "can it be simpler?" before the commit.** Once a worker has worked a while or reports ready: *"can it be simpler? reread your diff and cut anything not needed for the goal."* Sounds trivial; reliably shrinks diffs (Oskar, 2026-08-15 — a fad3 worker used it to probe-and-revert a speculative extra fix instead of shipping it). Cheap to send with the nudge loop.
- **`STEERING:` mid-flight.** A prompt prefixed that way reshapes scope or delivery without losing work; workers absorb it like a user typing into their session. Send follow-ups as separate prompts, never as an omnibus brief.
- **The human talks to panes too.** They may steer or approve inside a worker pane directly, so "approved mid-session" in a report can be genuine input you never saw. Read the pane and report before assuming state, and reconcile what happened into the task body.

## 6. Review gate

This is the half that makes a cheap implementer safe (§1), so it is not optional: an Opus 5 / Sonnet 5 agent reviews every non-trivial diff before it ships. Small diffs the orchestrator reviews personally. Review design and compactness, not just correctness; ask for cleaner rework instead of accepting sprawl. If a worker spins or stays weak, escalate the implementer instead of re-briefing endlessly — usually to Opus 5 via `--kind claude`.

**A worker's "checks pass" is not proof.** Require the pasted output, not the claim. A worker reported `bun run check` and `bun run test` passing on a commit that failed typecheck with five errors (2026-08-18); it shipped and blocked every other worker's gate until a different worker tripped over it. Workers report from memory of an earlier run, or from a scoped check run before their last edits. Put "run the full gate and paste the output" in the brief, and spot-check anything that lands. On a shared working copy one red commit blocks every other worker, and whoever broke it is usually idle by the time anyone notices. Watch for the shape that causes it: a change that adds a variant to a union — a new step kind, enum member, event type — and updates the producer but not every consumer. Name the consumers in the brief when you can see them.

The orchestrator's context is for taste and judgment, not code-reading (Oskar, 2026-08-17: "much cheaper to let your workers work — you can create as many as you want"). Reading modules to prep a brief, tracing a flow, or line-verifying a diff is itself delegable: spawn a reader/reviewer worker and keep only the conclusion. The orchestrator personally reviews the design and the report; when line-by-line verification is warranted, that's another worker's brief, not an inline read.

**Never hand-roll a static check and act on it.** (2026-08-17) An orchestrator wrote a regex "unused import" scan over a worker's refactor, believed it, deleted a live import, committed and pushed it. The name was called at 11 sites as `...makeSignalBase(state)` — a spread, so the leading `.` defeated the scan's `(?<![.\w$])` lookbehind, and the file would have 502'd every request. The reviewer worker that caught it used the language's own tooling (a TypeScript-API `checkJs` pass filtered to TS2304/2552/2662/2663) and was right the first time. Use the real parser, or brief a worker to; a regex over source is evidence of nothing.

Re-review fixes independently. After workers fix review findings, spawn a fresh pane with a stronger model and brief it to verify each fix against the original review's attack scenarios. This once caught a regression the implementer and the orchestrator's own diff review both missed: the fix's test suite encoded the bug as intended behavior, so running tests could never surface it. A different reviewer beats re-running tests.

## 7. Reset between tasks

A long-lived worker accumulates context and starts spinning in circles: re-litigating old decisions, rabbit-holing. After a task's report is in, wipe the session before the next brief:

```sh
herdr agent prompt <name> "/new" --wait --timeout 15000
```

- **Fresh worker per task.** Self-contained briefs plus committed reports make warm context unnecessary; a fresh agent reads the same material. Reuse a warm worker only when the next task continues its material, like reviewing fixes on its own diff.
- **`/new` between briefs by default** (Oskar, 2026-08-18). Reset unless the next brief is genuinely small. A brief that names its own `file:line` anchors is self-contained, so the warm context buys nothing and costs drift — including a worker's attachment to the design you just told it to abandon. After a REDESIGN verdict, reset before re-briefing.
- **Context ceiling** (Oskar, 2026-08-14): pi workers get stupid past ~200–250k tokens. Watch the statusline (`X%/272k`). Near ~200k mid-task, reset, compact, or rescope rather than pushing on. Split long design or research sessions into stages with fresh context per stage. Check the statusline *before each follow-up round*, not just mid-task (Oskar, 2026-08-17): past ~200k, prefer `/new` + a fresh self-contained brief over steering the warm session — a round-2 prompt to a near-ceiling worker inherits the degradation.
- **What drift looks like** (seen at 532k): the worker abandons its brief and chases side questions it wasn't asked, like source-diving to explain an anomaly instead of reporting it. Prompt an explicit exit: "stop investigating, post your report now with what you verified, then you are done." A real finding it surfaced is yours to chase in fresh context, not its.
- `/new` returns an `agent_prompt_stalled` error — slash commands complete instantly, so herdr sees no state change. Confirm with `agent read` ("✓ New session started", context back to 0.0%).
- `/new` also resets pi's thinking level to the agent's start args. If the pane started at a different level than you want now, follow with `/model` (see gotchas) and confirm the statusline.

## Gotchas

- **Address agents ONLY by their registered name — never a pane id.** `agent prompt <name>` errors `agent_not_found` for an agent outside your workspace's registry; retrying with a pane id (2026-08-17) delivered the prompt to the orchestrator's OWN session and the text also surfaced in other workers' panes, sending two mid-task workers chasing instructions meant for someone else. If the target isn't in `agent list`, you cannot reach it from here — relay through the human instead of improvising addressing.

  Corollary: **always pass a distinct `<name>` to `agent start`.** Several panes registered as `claude` make every agent-addressed command ambiguous (`agent send-keys claude` → `agent target claude not found`), and the pane-addressed fallback is unreliable — `pane send-keys <pane> enter` returns `ok` and sometimes does not submit, while `agent send-keys <name> enter` submits reliably. A pane you cannot address is a pane you can only close.

- **`--wait` timeout ≠ stuck.** On timeout it exits 1 with `{"error":{"code":"timeout"}}`, but the worker is usually still working. Do not re-prompt; that interrupts or queues a second task. Poll `herdr agent get <name>` until `agent_status` leaves `working`, then read the pane. Size `--timeout` generously for tasks with live waits or measurements.
- **`agent_pane_busy` right after `pane split`** ("not an available shell"): the shell hasn't spawned yet. Wait ~5–10s and retry once. Still refusing means a dud pane; close it and split fresh. `pane run "true"` can't wake a shell-less pane, and don't swallow `agent start` stderr. Persistent refusals track `--no-focus` (step 1). Reliable recipe: split focused, start the agent, then relocate the live worker with `herdr pane move <pane-id> --tab <tab-id> --split right|down --target-pane <sibling>`. `pane move` never disturbs the agent, but it silently no-ops (`changed:false, reason:"zoomed_tab"`) while the source tab is zoomed — `herdr pane zoom <pane-id> --off` first.
- **`--source recent-unwrapped` can return empty for pi panes**; `visible` works.
- **`Codex error: The usage limit has been reached` means the ChatGPT sub quota is gone, and it does not look like a failure.** A sol worker that hits it settles as `done` about 15 seconds after you brief it, having done nothing (2026-08-19). A fast `done` on a big slice is the tell — always read a pane that settles far quicker than the work deserves. Switching that worker to deepseek is a normal tier choice, not key-juggling: the quota is shared and the brief never depended on sol. Rebuild the pane with the right `--model` start args rather than using `/model`, and tell the human their sub quota is out — that part is theirs to know.
- **Past ~5 panes in a tab, `agent read` stops working** — each pane is ~15 columns wide, reports wrap into confetti, and the top of a settled report has already scrolled off the alternate screen. Read the worker's transcript from disk instead: Claude Code panes write `~/.claude/projects/<project-slug>/<uuid>.jsonl` (identify yours by its first user message: `jq -r 'select(.type=="user") | .message.content[]?.text' <f> | head -2`, then pull the final report with `jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text' <f> | tail -60`); pi panes write `~/.pi/agent/sessions/<project-slug>/<ts>_<uuid>.jsonl`, and their records nest one level deeper than Claude's — the working extraction is `jq -r 'select(.type=="message" and .message.role=="assistant") | (.message.content[]? | select(.type=="text") | .text)' <f> | tail -60`. A top-level `.role`/`.content` filter silently returns nothing on a pi session, which reads as "the worker produced no report" when the report is right there. This is more reliable than a wide pane, so reach for it whenever a report matters.
- **A prompt sent while pi is self-compacting is silently eaten.** The call returns but the worker stays idle. If `agent_status` never leaves idle, read the pane and re-send if compaction just finished. If the pane shows "Queued message for after compaction", it will fire on its own — don't re-send. Don't `esc` a compaction near the finish line; cancelling wastes the whole pass.
- **Tell workers not to fan out to subagents at all.** A pi worker's subagents route independently of its main model and die two ways: an OpenRouter 402 even when the worker's own provider is fine (2026-08-15, three librarian subagents), and expired Anthropic OAuth with `invalid_grant` when they default to Anthropic (twice, 2026-08-18). Both surface as the worker reporting `blocked` on what is really the house rule biting from underneath. A code-reading or code-editing brief needs no LLM fan-out: say "read the files directly with your own model, do not spawn subagents". Steer past it yourself when it happens — re-authing to make a forbidden path work is the wrong fix. Surface a genuine top-up to the human.
- **Switching a pi model mid-session.** `/model` opens a picker and leaves it open — the next prompt types into its fuzzy filter and does nothing, while `--wait` settles as if done. The full `id:level` string matches nothing there ("No matching models"); the `:level` suffix breaks the filter. Working recipe (2026-08-15): `/model <short-filter>` (e.g. `v4-pro`), read the pane to confirm the filtered list, `send-keys <name> enter` to take the top match, then confirm the statusline. Thinking level carries over from the pane's start args, so only the model id changes. Even then the switch can silently not take — if the model matters, rebuild the pane with the right start args instead of fighting the picker. Claude Code workers take `/model opus` directly, no picker; confirm the statusline before briefing.

---

This skill is a living doc. When you learn something about steering these workers — a model's failure mode, a better brief shape, a herdr trick — fold it in here rather than leaving it in the session.
