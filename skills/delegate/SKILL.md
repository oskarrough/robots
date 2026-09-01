---
name: arbe-delegate
description: Hand work to another agent running in a herdr pane — pick a worker, brief it, watch, steer, review. Use for parallelizable or throwaway work you don't want in your own context. Requires HERDR_ENV=1. To decide what to hand off and in what order first, see arbe-orchestrate.
---

# Delegate

Hand work to another agent in a herdr pane — parallelizable legwork, implementation or research that belongs in someone else's context. The judgment is what to hand off, to whom, how tightly to brief, how hard to verify; this skill is that layer. `herdr --skill` is the CLI guide; when it and this file disagree, it wins — check, then fix this file. When a herdr command errors or a worker misbehaves in a way this file doesn't name, read `references/troubleshooting.md` before improvising.

Precondition: `test "${HERDR_ENV:-}" = 1`. Workers go in panes, not headless `pi -p`, so you can watch and steer.

Not worth delegating: a single edit you already understand, work needing context only you hold, anything faster to do than to brief.

Two modes: **delegate and return** (start, brief, wait, read — the default) or **launch and hand off** (start it, report name + pane ID to the human, leave).

## Fast path: `herdr-delegate`

When `command -v herdr-delegate` succeeds, use it for a standard fresh-worker pipeline instead of one agent turn per herdr command:

```sh
# split → start → prompt → wait → read; leaves the worker warm
herdr-delegate <name> '<prompt>' --kind pi --timeout 60000 -- --provider openrouter --model z-ai/glm-5.3-flash
```

NAME and PROMPT are both required — fresh workers only. A warm worker gets `herdr agent prompt <name> '<prompt>'` directly (refuses busy workers, keeps context — `/new` first for an unrelated task, §5), watched per §3.

One JSON envelope comes back with handles, status, and raw `terminal_text`. `ok` means herdr accepted the prompt and returned pane text — not that the turn ran or succeeded; apply §3's settle checks. On failure follow `stage`, `upstream_herdr_error`, `cleanup`. Never `pane move` a worker while the wait is live — the wait dies with `agent_not_running` while the worker runs on fine. Drop to manual commands for multi-worker orchestration, steering, or placement that matters mid-run.

## 1. Pick a worker

Three roles, and no model wins price, speed, and trust at once:

- **orchestrator** — smart. That's you.
- **implementer** — the cheapest model that can hold the brief.
- **reviewer** — smart, and never the model that wrote the diff.

Smart direction + smart review + cheap implementation beats one expensive model doing all three — but only while the review actually happens (§4). Escalate the implementer when a brief keeps failing, not by default.

The standing flow: glm-5.3-flash implements most things; sol plans the hard stuff and reviews it after. Review by sol is mandatory for nitty-gritty work (prod migrations, dispatch/turn semantics, retry/error contracts) and merely good elsewhere — spend the expensive half where a miss hurts. Opus 5 (`--kind claude`) is still king for UI design work.

Current preferences — volatile, the only place ids live. Which account has headroom changes week to week; ask Oskar before assuming anything is free, and don't re-add a benched model (terra, haiku, deepseek) without him:

| role | model |
| --- | --- |
| slow, hard thinking; the review gate | Opus 5: `--kind claude -- --model opus --effort high` (`xhigh` for hard implementation or adversarial review). `gpt-5.6-sol:high` for the hardest cross-layer work. |
| fast exploring, scouting, smoke tests | `z-ai/glm-5.3-flash` via `--kind pi` — first pick right now (Oskar, 2026-09-01): spin up many, demand a few plain lines back, no jargon; drifts without tight direction. Also `gpt-5.6-luna` (Codex sub) or `cursor-grok-4.6-high` (`--kind cursor`). |
| cheap, stable implementer | `z-ai/glm-5.3-flash` via `--kind pi` (OpenRouter, per-token; max output 131k). `gpt-5.6-sol:medium` when the Codex sub has headroom. |

```sh
herdr agent start <name> --kind claude --pane <pane-id> -- --model opus --effort high
herdr agent start <name> --kind pi --pane <pane-id> -- --provider openai-codex --model "gpt-5.6-sol:high"
herdr agent start <name> --kind cursor --pane <pane-id> -- --model cursor-grok-4.6-high
```

Billing and model traps — kind first, model second, because the kind picks which account pays:

- Codex sub is `--kind pi --provider openai-codex`. Never the `openai/...` id or plain `--provider openai` — both bill per-token. Verify after every start: statusline reads `(openai-codex)` with a `$x.xxx (sub)` marker.
- Cursor effort is baked into the id (`-low`/`-high`/`-xhigh`), not a `:suffix`; never a `-fast` variant. `cursor-agent models` lists everything.
- Anthropic models from inside pi return a 402 that reads exactly like a real out-of-credits blocker — that capacity is for `--kind claude` workers.
- `:high` is the worker ceiling; xhigh buys little on a well-scoped brief and loops cheap models.
- An invalid `model:level` doesn't error — pi warns and falls through with thinking off. Check the statusline after start.
- Cheap OpenRouter models die mid-turn (`Provider finish_reason: error`); the session survives, so prompt "continue, that was a transient provider error". Recurring on one task, or a brief that secretly needs a design pass (they spiral instead of asking): escalate to sol or re-slice.

Placement: `pane create` does not exist — it's `pane split <pane> --direction right|down`, always with `--current` or an explicit id, since with no target herdr splits the UI-focused pane, which may be the human's. Panes built inside a `tab create --no-focus` tab are permanently unstartable — split where you are, start the worker, then `pane move` it across.

**Every pane and agent gets a distinct name, and you address agents only by name, never a pane id** — a pane-id retry once delivered text to the orchestrator's own session and to other workers' panes. Not in `agent list` = unreachable; relay through the human. Name it after the job: max 3 plain words carrying object and action, so a bystander can answer "doing what to what?" (`drop-old-secrets`, `review-secrets`; not `stop-retrying` — retrying what?). No task ids, model names, or jargon; never `claude` or `worker`. Check `agent list` before reusing a name — duplicates make every agent-addressed command ambiguous. `pane rename` is only for panes with no registered agent (dev servers, log tails) — name those too. **Workers never stay in the human's tab**: give every batch its own labelled tab named for the work (`tab create --workspace <id> --label "www polish"`, then `pane move <pane> --tab <id> --split right --target-pane <id>`), so a glance at the tab bar says what is running; `tab create` lands in the *focused* workspace without `--workspace`, which is rarely yours.

## Run a crew, not a dispatch

Default to a standing tab of ~4 warm workers you feed small tasks. Spawning costs a real minute; a warm crew makes dispatch nearly free, which flips the economics — small asks, steered often, with you holding the quality bar continuously instead of encoding it in one huge brief. `/new` between tasks is cheaper than a new pane; `agent list` is the work queue. Tedious ops chains — push migrations, deploy, verify, regenerate types — go to a general glm assistant too, briefed to ping back. Start a fresh agent only when kind/model must differ, isolation is part of the proof, the worker is near its context ceiling, or it has drifted.

Crew mode makes two things harder, so spend the savings there: warm workers collide constantly on the shared working copy, so fence every dispatch every time (§2); and a worker that never got its prompt looks exactly like one waiting for work, so keep §3's settle checks honest.

Slice by what actually parallelizes: additive work (separate features, docs, routes) fans out because the files are disjoint; a deletion sweep cascades type errors into callers, so give it one owner and fan out around it. Max 4 workers per tab so the human can actually see them: 2x2, or one row of 3; a 5th gets a new tab, because past 4 panes go ~15 columns wide and `agent read` returns confetti.

## 2. Brief

Size an ask so its result reviews and ships in one sitting, and a drifted worker loses one increment rather than a day. Too big when it needs many unrelated scope bullets, spans surfaces that deploy separately, or you can't name what you'd deploy when it lands. Split before briefing.

Long or reusable briefs go in a file (`brief-<task>.md`, prompt with the path plus "follow it exactly"); a two-line ask is just a prompt. Running a crew, hoist the recurring rules (fencing, jj, scoped checks, the contracts below) into one `rules-common.md` every brief opens with "read it first, binding" — each brief then carries only its own task. Either way the brief is yours to write: it encodes design decisions, and a scout's findings are input to it, not a draft of it. Substance lives in the tracked task (what/why/done-when/evidence); the brief carries this run's mechanics — fileset, report shape, whichever rules below apply.

- **Fence by dependency direction, not directory.** Workers reach down into shared layers to thread a parameter, so ask what the *other* live workers' tasks depend on, not just where they live, and name the off-limits files: "do not edit X, Y, Z — another worker owns them; if your change genuinely requires one, stop and ask." When a collision lands anyway, the unblock is usually a split — the half that needs the contended file vs. the half that doesn't — not a wait.
- **The deliverable is a compact end-of-turn report — max 10 lines — read from the pane.** Never ask a worker to *commit* a report; gitignored `tmp/` silently drops it. Long output (measurements, inventories) goes in a file you read from disk.
- Ask for plain language — workers write like patent lawyers, and reports get relayed to the human. `/arbe-bro` is the register.
- **Proof is using arbe, not test code** (Oskar, 2026-09-01): brief for one live CLI probe in a test house with the thread id in the report; a unit test only where a probe can't see the behavior. Same for comments: none that restate the code.
- **A test can synthesize its own input and prove nothing.** When a fix keys on another service's data shape, require a `file:line` citation of the *producing* code.
- Don't name skills only your harness has — they don't exist inside pi/cursor workers and stall them at a fake blocker. Point at the SKILL.md path on disk (resolve it first: `readlink -f ~/.claude/skills/<name>`; most live under `~/sites/robots/skills/`, not the repo's `packages/skills/`) or inline the rules, and name local code precedent. A wrong path is a real blocker to a worker that was told the file is binding.
- **"Scan the codebase for X" needs a measurement, not an adjective.** Measure first yourself; hand over the numbers, a cap, exclusions, and keep-criteria. Ungrounded, the same brief rewrites hundreds of files.
- State ownership and vocabulary: who owns gated actions ("write the migration, do NOT push"), the exact enums they'll write.
- **jj**: point at `arbe-jj-jujutsu`, binding. Commit only your own files, don't reshape history, report repairs instead of making them.
- **Commit outcomes, not agent footsteps.** One builder run → one implementation commit (code, task close, changelog). Mid-batch, leave same-domain tracker bookkeeping for your final integration commit; once the batch is idle, squash same-domain fragments into the smallest reviewable set. Never rewrite history while workers are active.
- **Files every worker must touch, own yourself** (changelog, a tracker with concurrent-write bugs): "do not add a changelog entry, do not run task update/close — I do both as your work lands."
- **Test runs: only the touched files, from the package directory.** Workers default to the whole package suite after every edit; on a shared copy that is minutes per run, and they pad it with `sleep` and 600s timeouts. Brief `cd <package> && bun run test <file>` and one scoped check before commit; never a backgrounded run. From the repo root a file path fans out to every workspace and reads as a failure ("No test files found") — a fake blocker.
- On a shared copy, repo-wide checks go red under a worker from others' uncommitted edits. Say so: red outside your fileset is expected, verify with scoped checks and commit your own files; repo-green re-verification waits for the tree to settle.
- **Blockers: one line and stop** — dead key, dead server, missing auth. Say explicitly that a stopped shared service (a Fly machine, the backstage, the dev server) is a blocker to report, never to start: a glm worker found the backstage machine stopped and started it to finish its probe (2026-09-02). Same for your own fences: a scope rule blocking the right fix gets reported, not detoured around.
- pi subagents route independently of their parent and die on 402s/expired OAuth as fake blockers — tell the worker to use its own model and not fan out.
- **Require a written closing report — silence is indistinguishable from success.** State both contracts verbatim:

> To ask the orchestrator anything or report a blocker: stop, print one final line starting with `ORCHESTRATOR: <question or blocker>`, and end your turn. Your settled pane IS the message — it is read promptly. Do not look for another channel; do not work around the question.

> Your last turn must be a written report of what you did. Not a tool call, not silence. If you did nothing, say you did nothing and why. An empty final turn means the work is not done, and I will treat it as a failure rather than a result.

## 3. Watch and steer

Prompt fire-and-forget, then watch with a detached wait. It keeps your turn free and scales to any number of workers — one background wait per name — where `--wait` blocks your whole turn, and aborting it doesn't un-send the prompt; the worker runs on:

```sh
herdr agent prompt <name> '<brief>'   # text is a positional BEFORE any flags
herdr agent wait <name> --until done --until blocked   # run in background; chain `herdr notification show` to ping the desktop
```

Watch an explicit name list — the human and other orchestrators run panes too — and act on `blocked` immediately. pi workers carry the `herdr-agent-state` extension, so done/blocked are lifecycle signals, not guesses; the checks below guard the *result*.

Liveness first: `agent prompt` has returned success while the text never landed, and a never-started worker is `idle` just like a finished one. Grep the context percentage out of `pane read --source visible` right after prompting, confirm it moved off `0.0%`, resend once if swallowed. Don't add fixed sleeps after `agent start` — herdr waits for readiness.

**A settle is a claim, not a result.** `agent_status` alone can lie: `done` at submit time before the agent started, idle-flapping between tool calls on pi and cursor. A real settle needs status in {idle, done} AND `pane read <pane> --source visible` free of spinner text — grep `Working\.\.\.|esc to interrupt|⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` — twice, 20s apart.

Then read the pane and classify before acting. The predicate is *visible assistant text* (thinking-only counts as empty) — never tokens or elapsed time; a run can bill tokens and produce nothing:

| what you see | what happened | what to do |
|---|---|---|
| statusline `0.0%/272k` | the prompt never landed | re-send it; nothing ran |
| context burned, no text, no diff | ran and produced nothing | retry or escalate — never accept |
| context burned, no text, real diff | did the work, skipped the report | ask for the report; don't redo the work |
| assistant text present | a real report | review it |

Corroborate against the repo: `jj st` and `jj log` are the second opinion. A claimed commit that isn't there, or a silent settle while the tree changed, is the same defect from either side.

Steering:

- **A settled Claude Code pane's composer may hold ghost text nobody typed** — a suggested message in the human's voice that reads like an answer. `send-keys <name> esc` clears it; only your own conversation with the human is real.
- **Checkpoint deep-in-the-weeds workers**: esc, then ask them to pause and restate in ~15 lines — goal, design bullets, files touched, anything added that isn't strictly needed. Catches drift and gold-plating before code lands; follow with an explicit go.
- **"Can it be simpler — reread your diff and cut anything not needed for the goal"** reliably shrinks diffs. Cheap to send before the commit.
- **`STEERING:` mid-flight** reshapes scope without losing work. Follow-ups as separate prompts, not an omnibus brief.
- **The human steers panes directly too** — "approved mid-session" in a report can be real input you never saw.

## 4. Review

The review is what makes a cheap implementer safe, so it's the half not to skip: a strong model reviews every non-trivial diff, never the author. Review design and compactness, not just correctness — ask for cleaner rework instead of accepting sprawl.

- **A reviewer's FIX is a finding, not an order.** Weigh each one against the system before relaying it: a technically-true note ("a contended wake never reaches the last-attempt reconcile") became two fix rounds and a loop before anyone asked whether the holder already covered it (2026-09-02). Relay the ones that change an outcome a user would see; answer the rest in the re-review prompt.
- **"Checks pass" is not evidence — ask for the pasted output.** Workers report from memory or from a scoped run before their last edits. Classic shape: a new union variant that updates the producer but not every consumer — name the consumers in the brief when you can see them.
- A regex over source is evidence of nothing; one "unused import" scan nearly deleted a live import used at 11 sites. Use the language's own tooling, or brief a worker to.
- A fix's own tests can encode the bug as intended behavior. Verify with a fresh pane and a stronger model, against the original review's attack scenarios.
- **The worker tests the reproduction; you test the fix's mechanism.** Ask "what else flows through the thing they changed?" and probe that path. A ten-line script importing the changed function directly beats reading the diff twice (absolute import path; relative from a scratchpad won't resolve).
- **Reproduce a reported blocker outside the worker's change before believing it** — a cold-started service 404s in ways a worker can't distinguish from its own bug. Then make it compound: file the bad diagnostic, not just the unblock.
- A blocked worker is usually 30 seconds of your time, not theirs. Check the *current* tree state when unblocking, not the state you briefed against — the contended file may already be committed.
- **Your context is for taste, not code-reading.** Module reading, flow tracing, line-verifying a diff — all delegable. Keep the conclusion, not the files.
- **`jj describe` mints a new commit id** — reword mid-review and the reviewer is auditing an id that no longer exists. Re-steer with the new id, or hold the rewording until the review lands.
- **A concurrent commit can absorb your worker's edits or change a contract under them.** jj snapshots the working copy, so another pane committing a file your worker edited takes those edits with it, and "no remaining diff" is then not failure. After any fix round on a busy copy: `jj log` for mid-flight commits, `jj show --stat` for where your edits actually live, then point the re-review at interactions with those commits.
- A cheap scout's conclusions can be right while its file:line citations are invented. Spot-check the load-bearing paths before pasting them into an implementation brief.
- **"I found nothing" is the easiest wrong answer, and it arrives with full confidence.** Absence is only evidence if the search was right: a negative brief says *how* to look (time window, commit count, the files the work would touch) and requires the report to state its method. Sanity-check any "nothing found" against what you already believe.

## 5. Reset between tasks

A long-lived worker accumulates context, re-litigates old decisions, rabbit-holes. Reset without paying pane/model startup:

```sh
herdr agent prompt <name> "/new" --wait --timeout 15000
```

- Same task or direct follow-up: keep context. Unrelated self-contained task: `/new` first. Rejected design or drift: `/new` — don't let it defend stale work. Isolation part of the proof (benchmarks, session-state tests): genuinely fresh agent.
- most LLMs get less intelligent past ~200–250k tokens (statusline `X%/272k`), and claude workers hit the same. Near the ceiling, `/new` plus a fresh brief beats steering the warm session; watch reviewers especially, since repeated rounds pile up quietly.
- Drift looks like abandoning the brief for side questions. Prompt an exit: "stop investigating, post your report with what you verified, then you are done." Anything real it surfaced is yours to chase in fresh context.
- `/new` returns `agent_prompt_stalled` — slash commands finish instantly, so herdr sees no state change; confirm with `agent read`. It also resets pi's thinking level to the start args.
- **Close panes you created** once their work is committed and reviewed (`pane close <pane-id>`; leave the human's and other orchestrators'). Lingering settled panes crowd the tab and read as live workers to the next orchestrator.

---

Living doc, with a growth cap: fold a learning in as a one-line rule, deduped against what's already here — keep incident detail only when the rule is unbelievable without it. Recovery procedures and per-provider failure modes go in `references/troubleshooting.md`, pure CLI mechanics in `herdr --skill`, volatile model ids only in §1's table. The less we have in this file, the better.
