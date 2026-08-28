---
name: arbe-delegate
description: Delegate work to agent panes via herdr — spawn a pane, start an agent of any kind, brief it, read the result, steer or stop it. Same commands whether you orchestrate from Claude Code, pi, or Codex.  Use for parallelizable or throwaway work you don't want in your own context. To decide *what* to hand off and in what order, see arbe-orchestrate.
---

# Delegate

Hand work to another agent running in a herdr pane — parallelizable legwork, implementation or research that should run in someone else's context. Delegating well is a judgment question: what to hand off, to whom, how tightly to brief, how hard to verify. This skill is that judgment layer. `herdr --skill` is the CLI guide (IDs, pane/agent commands, lifecycle states, read sources); when this file and the tool disagree, the tool wins — check, then fix this file.

Precondition: `test "${HERDR_ENV:-}" = 1`. Workers go in panes rather than headless `pi -p`, so you can watch and steer them.

Not worth delegating: a single edit you already understand, work needing context only you hold, anything faster to do than to brief.

Two modes: **delegate and return** (start, brief, wait, read — the default), or **launch and hand off** (start it, report name + pane ID to the human, leave).

## Fast path: `herdr-delegate`

When `command -v herdr-delegate` succeeds, use it for standard single-worker pipelines instead of one agent turn per herdr command:

```sh
# Fresh worker: split → start → prompt → wait → read; leaves the worker warm
herdr-delegate run <name> '<prompt>' --kind pi --timeout 60000 -- --provider openai-codex --model gpt-5.6-luna

# Fresh worker without a prompt; ready for handoff
herdr-delegate launch <name> --kind pi -- --provider openai-codex --model gpt-5.6-luna

# Existing worker: prompt → wait → read; keeps its conversation context
herdr-delegate prompt <name> '<prompt>' --timeout 60000
```

One JSON envelope with handles, status, and raw `terminal_text`. `ok` means herdr accepted the prompt and returned readable pane text — not that the turn ran or the task succeeded; apply §3's settle checks before trusting it. On failure follow `stage`, `upstream_herdr_error`, `cleanup`. `prompt` refuses workers that are working, blocked, or unknown, and keeps context — `/new` first for an unrelated task (§5). Use the manual commands for multi-worker orchestration, steering, or unusual placement.

## 1. Pick a worker

Three roles, and no model wins price, speed, and trust at once:

- **orchestrator** — smart. That's you.
- **implementer** — the cheapest model that can hold the brief.
- **reviewer** — smart, and never the model that wrote the diff.

Smart direction + smart review + cheap implementation beats one expensive model doing all three — but only while the review actually happens (§4). Escalate the implementer when a brief keeps failing, not by default.

Current preferences — volatile, the only place ids live. Which account has headroom changes week to week; ask Oskar before assuming anything is free, and don't re-add a benched model (terra, haiku, deepseek) without him:

| role | model |
| --- | --- |
| slow, hard thinking; the review gate | Opus 5: `--kind claude -- --model opus --effort high` (`xhigh` for hard implementation or adversarial review). `gpt-5.6-sol:high` for the hardest cross-layer work. |
| fast exploring, scouting, smoke tests | `gpt-5.6-luna` (Codex sub) or `cursor-grok-4.6-high` (`--kind cursor`). |
| cheap, stable implementer | `z-ai/glm-5.3-flash` via `--kind pi` (OpenRouter, per-token; max output 131k). `gpt-5.6-sol:medium` when the Codex sub has headroom. |

Billing and model traps — kind first, model second, because the kind picks which account pays:

- Codex sub is `--kind pi --provider openai-codex`. Never the `openai/...` id (routes via OpenRouter, per-token) and never plain `--provider openai` (API key, per-token). Verify after every start: statusline reads `(openai-codex)` with a `$x.xxx (sub)` marker.
- Cursor: effort is baked into the id (`-low`/`-high`/`-xhigh`), not a `:suffix`; never a `-fast` variant. `cursor-agent models` lists everything.
- Don't reach for Anthropic models from inside pi — that capacity is for `--kind claude` workers, and violating it returns a 402 that reads exactly like a real out-of-credits blocker.
- `:high` is the worker ceiling; xhigh buys little on a well-scoped brief and loops cheap models.
- An invalid `model:level` string doesn't error — pi warns and falls through with thinking off. Check the statusline after start.
- Cheap models via OpenRouter can die mid-turn (`Provider finish_reason: error`) — the session survives; prompt "continue, that was a transient provider error". Recurring on one task, or a brief that secretly needs a design pass (they spiral instead of asking): escalate to sol or re-slice.

```sh
herdr agent start <name> --kind claude --pane <pane-id> -- --model opus --effort high
herdr agent start <name> --kind pi --pane <pane-id> -- --provider openai-codex --model "gpt-5.6-sol:high"
herdr agent start <name> --kind cursor --pane <pane-id> -- --model cursor-grok-4.6-high
```

**Every pane and agent gets a distinct name — no exceptions.** It's the only handle you and the human have on a worker. Name by role and scope (`reviewer`, `doc-env`, `flash-migrate`), never `claude` or `worker`. Don't triple-name: `pane rename` is only for panes with no registered agent (dev servers, log tails) — name those too. `tab create --label` when a batch gets its own tab.

## Run a crew, not a dispatch

Default to a standing tab of ~4 warm workers you feed small tasks. Spawning costs a real minute; a warm crew makes dispatch nearly free, which flips the economics — small asks, steered often, with you holding the quality bar continuously instead of encoding it in one huge brief. `/new` between tasks is cheaper than a new pane; `agent list` is the work queue. Start a fresh agent only when kind/model must differ, isolation is part of the proof, the worker is near its context ceiling, or it has drifted.

Crew mode makes two things harder — spend the savings there:

- **Fencing.** Warm workers in one repo collide constantly on the shared working copy. Every dispatch names its fileset AND the off-limits files, every time.
- **Idle for the wrong reason.** A worker that never got its prompt looks exactly like one waiting for work — keep §3's settle checks honest.

Slice by what actually parallelizes: additive work (separate features, docs, routes) fans out because the files are disjoint; a deletion sweep cascades type errors into callers, so give it one owner and fan out around it. Past ~5 panes in a tab, panes go unreadably narrow — read transcripts from disk (Gotchas).

## 2. Brief

Size an ask so its result reviews and ships in one sitting, and a drifted worker loses one increment rather than a day. Too big when it needs many unrelated scope bullets, spans surfaces that deploy separately, or you can't name what you'd deploy when it lands. Split before briefing.

Long or reusable briefs go in a file (`brief-<task>.md`, prompt with the path plus "follow it exactly"); a two-line ask is just a prompt. Either way the brief is yours to write — it encodes design decisions. A scout's findings are input to it, not a draft of it. Substance lives in the tracked task (what/why/done-when/evidence); the brief carries this run's mechanics: fileset, report shape, whichever rules below apply.

- **Fence the shared working copy by dependency direction, not directory.** Workers reach down into shared layers to thread a parameter; ask what the *other* live workers' tasks depend on, not just where they live, and name the off-limits files: "do not edit X, Y, Z — another worker owns them; if your change genuinely requires one, stop and ask." When a collision lands anyway, the unblock is usually a split (the half that needs the contended file vs. the half that doesn't), not a wait.
- **The deliverable is a compact end-of-turn report (≤40 lines) read from the pane.** Never ask a worker to *commit* a report — gitignored `tmp/` silently drops it. Long output (measurements, inventories) goes in a file you read from disk.
- Ask for plain language — workers write like patent lawyers, and reports get relayed to the human. `/arbe-bro` is the register.
- **A test can synthesize its own input and prove nothing.** When a fix keys on another service's data shape, require a `file:line` citation of the *producing* code.
- Don't name skills only your harness has — they don't exist inside pi/cursor workers and stall them at a fake blocker. Point at the SKILL.md path on disk or inline the rules, and name local code precedent.
- **"Scan the codebase for X" needs a measurement, not an adjective.** Measure first yourself; hand the worker the numbers, a cap, exclusions, and keep-criteria. Ungrounded, the same brief rewrites hundreds of files.
- State ownership and vocabulary: who owns gated actions ("write the migration, do NOT push"), the exact enums they'll write.
- **jj**: point at `arbe-jj-jujutsu`, binding. Commit only your own files, don't reshape history, report repairs instead of making them.
- **Commit outcomes, not agent footsteps.** One builder run → one implementation commit (code, task close, changelog). During a multi-worker batch, leave same-domain tracker bookkeeping for the orchestrator's final integration commit; once the batch is idle, squash same-domain fragments into the smallest reviewable set. Never rewrite history while workers are active.
- **Files every worker must touch, own yourself** (changelog, a tracker with concurrent-write bugs): "do not add a changelog entry, do not run task update/close — I do both as your work lands."
- On a shared copy, repo-wide checks go red under a worker's feet from others' uncommitted edits. Put it in the brief: red outside your fileset is expected — verify with scoped checks, commit your own files; repo-green re-verification happens after the tree settles.
- **Blockers: one line and stop** — dead key, dead server, missing auth. Same for your own fences: a scope rule blocking the right fix gets reported, not detoured around.
- pi subagents route independently of their parent and die on 402s/expired OAuth as fake blockers — tell the worker to use its own model and not fan out.
- **Require a written closing report — silence is indistinguishable from success.** State both contracts verbatim:

> To ask the orchestrator anything or report a blocker: stop, print one final line starting with `ORCHESTRATOR: <question or blocker>`, and end your turn. Your settled pane IS the message — it is read promptly. Do not look for another channel; do not work around the question.

> Your last turn must be a written report of what you did. Not a tool call, not silence. If you did nothing, say you did nothing and why. An empty final turn means the work is not done, and I will treat it as a failure rather than a result.

## 3. Watch and steer

One worker: `agent prompt --wait` (or `agent wait`) blocks until the first settled state — don't poll. Several: no native multi-wait exists, so poll `agent list`: watch an explicit name list (the human and other orchestrators run panes too), print `.name` not `.agent`, report `blocked` immediately, and only trust idle/done per the settle check below.

**A settle is a claim, not a result.** `agent_status` alone is unreliable: `agent prompt --wait` has returned `done` at submit time before the agent started, and pi flaps idle between tool calls, defeating 10–15s debounces (cursor too). A real settle needs status in {idle, done} AND `pane read <pane> --source visible` free of spinner text — grep `Working\.\.\.|esc to interrupt|⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` — twice, 20s apart. Wrap that in a `settled()` shell function and the polling loop becomes reliable.

Then read the pane and classify before acting. The predicate is *visible assistant text* (thinking-only counts as empty) — never tokens or elapsed time; a run can bill tokens and produce nothing:

| what you see | what happened | what to do |
|---|---|---|
| statusline `0.0%/272k` | the prompt never landed | re-send it; nothing ran |
| context burned, no text, no diff | ran and produced nothing | retry or escalate — never accept |
| context burned, no text, real diff | did the work, skipped the report | ask for the report; don't redo the work |
| assistant text present | a real report | review it |

Corroborate against the repo: `jj st` and `jj log` are the second opinion. A claimed commit that isn't there, or a silent settle while the tree changed, is the same defect from either side.

Liveness after prompting: `agent prompt` has returned success while the text never landed, and a never-started worker is `idle` just like a finished one. Grep the context percentage out of `pane read --source visible` right after prompting and confirm it moved off `0.0%` before you start watching. Don't add fixed sleeps after `agent start` — herdr waits for readiness; prompt immediately, verify, resend once if swallowed.

Steering:

- **A settled Claude Code pane's composer may hold ghost text nobody typed** — a suggested message in the human's voice that reads like an answer. `send-keys <name> esc` clears it; only your own conversation with the human is real.
- **Checkpoint deep-in-the-weeds workers**: esc, then ask them to pause and restate in ~15 lines — goal, design bullets, files touched, anything added that isn't strictly needed. Catches drift and gold-plating before code lands; follow with an explicit go.
- **"Can it be simpler — reread your diff and cut anything not needed for the goal"** reliably shrinks diffs. Cheap to send before the commit.
- **`STEERING:` mid-flight** reshapes scope without losing work. Follow-ups as separate prompts, not an omnibus brief.
- **The human steers panes directly too** — "approved mid-session" in a report can be real input you never saw.

## 4. Review

The review is what makes a cheap implementer safe, so it's the half not to skip: a strong model reviews every non-trivial diff, never the author. Review design and compactness, not just correctness — ask for cleaner rework instead of accepting sprawl.

- **"Checks pass" is not evidence — ask for the pasted output.** Workers report from memory or from a scoped run before their last edits. Classic shape: a new union variant that updates the producer but not every consumer — name the consumers in the brief when you can see them.
- A regex over source is evidence of nothing (one "unused import" scan nearly deleted a live import used at 11 sites). Use the language's own tooling, or brief a worker to.
- A fix's own tests can encode the bug as intended behavior. Verify with a fresh pane and a stronger model, against the original review's attack scenarios.
- **The worker tests the reproduction; you test the fix's mechanism.** Ask "what else flows through the thing they changed?" and probe that path — a green repro plus a new bug on the untested path is a real observed outcome. A ten-line script importing the changed function directly beats reading the diff twice (absolute import path; relative from a scratchpad won't resolve).
- **Reproduce a reported blocker outside the worker's change before believing it** — a cold-started service 404s in ways a worker can't distinguish from its own bug. Then make it compound: file the bad diagnostic, not just the unblock.
- A blocked worker is usually 30 seconds of your time, not theirs. Check the *current* tree state when unblocking, not the state you briefed against — the contended file may already be committed.
- **Your context is for taste, not code-reading.** Module reading, flow tracing, line-verifying a diff — all delegable. Keep the conclusion, not the files.
- **A concurrent commit can absorb your worker's edits or change a contract under them** — jj snapshots the working copy, so another pane committing a file your worker edited takes those edits with it ("no remaining diff" is then not failure). After any fix round on a busy copy: `jj log` for mid-flight commits, `jj show --stat` for where your edits actually live, and point the re-review at interactions with those commits.
- A cheap scout's conclusions can be right while its file:line citations are invented. Spot-check the load-bearing paths before pasting them into an implementation brief.
- **"I found nothing" is the easiest wrong answer, and it arrives with full confidence.** Absence is only evidence if the search was right: a negative brief says *how* to look (time window, commit count, the files the work would touch) and requires the report to state its method. Sanity-check any "nothing found" against what you already believe.

## 5. Reset between tasks

A long-lived worker accumulates context, re-litigates old decisions, rabbit-holes. Reset without paying pane/model startup:

```sh
herdr agent prompt <name> "/new" --wait --timeout 15000
```

- Same task or direct follow-up: keep context. Unrelated self-contained task: `/new` first. Rejected design or drift: `/new` — don't let it defend stale work. Isolation part of the proof (benchmarks, session-state tests): genuinely fresh agent.
- pi degrades past ~200–250k tokens (statusline `X%/272k`). Near the ceiling, `/new` plus a fresh brief beats steering the warm session.
- Drift looks like abandoning the brief for side questions. Prompt an exit: "stop investigating, post your report with what you verified, then you are done." Anything real it surfaced is yours to chase in fresh context.
- `/new` returns `agent_prompt_stalled` (slash commands finish instantly; herdr sees no state change) — confirm with `agent read`. It also resets pi's thinking level to the start args.
- **One orchestration, one tab**: `pane move <pane> --new-tab --label "<name>"` for the first worker, `pane move <pane2> --tab <tab-id> --split down` for the rest, `tab rename` to match the session's numbering.
- **Close panes you created** once their work is committed and reviewed (`pane close <pane-id>`; leave the human's and other orchestrators'). Lingering settled panes crowd the tab and read as live workers to the next orchestrator.

## Gotchas

- **`pane create` does not exist** — it's `pane split <pane> --direction right|down`, and always with `--current` or an explicit id: with no target herdr splits the UI-focused pane, which may belong to the human.
- **`agent prompt <name> "<text>" --wait`** — text is a positional before any flags; flags-first fails with `unknown option: <your whole prompt>`, which reads like a quoting bug and isn't.
- **Result envelopes aren't uniform** — `pane split` returns `.result.pane`, `pane move` doesn't. Verify with `pane list` rather than trusting a field name across commands.
- **Address agents ONLY by registered name, never a pane id** — a pane-id retry once delivered text to the orchestrator's own session and other workers' panes. Not in `agent list` = unreachable; relay through the human.
- **Check `agent list` before reusing a name** — duplicates make every agent-addressed command ambiguous and collapse in the sidebar.
- **`--wait` timeout ≠ stuck** — exits 1 with `{"error":{"code":"timeout"}}` but the worker is usually still working. Don't re-prompt; poll `agent get` until `agent_status` leaves `working`.
- **Panes in a `tab create --no-focus` tab are permanently unstartable** — healthy-looking prompt, `agent_status: "unknown"`, `agent_pane_busy` forever. Build workers where you are (`pane split --current`), start them, then `pane move` into the new tab.
- **Try `agent start` immediately after `pane split`** — on `agent_pane_busy`, wait ~5–10s and retry once; still refusing is a dud pane, close and split fresh. `pane move` never disturbs a live agent but silently no-ops on a zoomed tab — `pane zoom <pane-id> --off` first.
- **`--source recent-unwrapped` can return empty for pi panes**; `visible` works.
- **`Codex error: The usage limit has been reached`** settles as `done` ~15s after briefing with nothing done — a fast `done` on a big slice is the tell. Rebuild with a different model and tell the human their sub quota is out. General rule, any provider: `done` with no assistant text is not a completion (§3).
- **Past ~5 panes in a tab, `agent read` returns confetti** — panes go ~15 columns wide. Read the transcript from disk:
  ```sh
  # Claude Code: ~/.claude/projects/<slug>/<uuid>.jsonl
  jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text' <f> | tail -60
  # pi: ~/.pi/agent/sessions/<slug>/<ts>_<uuid>.jsonl — records nest one level deeper
  jq -r 'select(.type=="message" and .message.role=="assistant") | (.message.content[]? | select(.type=="text") | .text)' <f> | tail -60
  ```
  A top-level `.role`/`.content` filter silently returns nothing on a pi session, which reads as "no report" when the report is right there.
- **A prompt sent while pi is self-compacting is silently eaten** — if `agent_status` never leaves idle, read the pane and re-send. "Queued message for after compaction" fires on its own; don't re-send, and don't `esc` a compaction near the finish line.
- **Switching a pi model mid-session is unreliable** — `/model` opens a picker the full `id:level` string doesn't match. If the model matters, rebuild the pane with the right start args. Claude Code takes `/model opus` directly.

---

Living doc, with a growth cap: fold a learning in as a one-line rule, deduped against what's already here — keep incident detail only when the rule is unbelievable without it. Pure CLI mechanics belong in `herdr --skill`; volatile model ids belong only in §1's tables.
