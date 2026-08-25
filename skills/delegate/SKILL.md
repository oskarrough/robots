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
| `deepseek/deepseek-v4-flash-0731:high` | very cheap | fast | low-medium | implementer for tight mechanical briefs — renames, ports, test runs. Never unreviewed (Oskar, 2026-08-23): always gate its diff, and direct it — pin the design, demand a plan checkpoint before edits, steer mid-flight. |
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

**Every pane and agent you create gets a name — no exceptions.** The name is what the herdr sidebar shows, and it's the only handle you and the human have on a worker; an unnamed or default-named pane is an anonymous box nobody can address or reason about. `agent start` takes the name as its first argument, so there is never a reason to skip it.

Name by role and scope, distinctly (`reviewer`, `doc-env`, `flash-migrate`) — never `claude`, `worker`, or anything you'd reuse. Then stop: the sidebar plus the agent's own terminal title cover the rest, so don't triple-name by also renaming the pane. `pane rename <pane-id> <task>` is for panes with **no** registered agent (Ox Alpha below, dev servers, log tails) — name those too, or the sidebar fills with unlabelled shells. `tab create --label` when a batch gets its own tab.

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
- **A brief that names a skill only YOUR harness has blocks the worker.** Claude Code skills (supabase plugin, /arbe-* commands) don't exist inside pi/cursor workers — a brief saying "load the X skill" stalls them at a fake blocker. Point at the skill's SKILL.md path on disk (find it under ~/.claude/plugins/cache or packages/skills/) or inline the rules, and name local code precedent to mirror.
- **A "scan the codebase for X" brief needs a measurement, not an adjective.** Measure first yourself, then hand the worker the numbers. For "find over-long comments" a 40-line scanner found 1008 blocks of 6+ lines across 10,079 comment lines; the worker got that ranked list, a cap (review the top 60, propose at most 20), report-only-no-edits, the exclusions (generated files), and the keep-criteria (why-comments and contracts stay). It came back with 14 precise proposals carrying per-item "keep this much" text. Ungrounded, the same brief rewrites hundreds of files.
- **Workers guess at ownership and vocabulary** unless told. Who owns gated actions ("write the migration, do NOT push"), and the exact enums they'll write ("close with `closed`; `in_review` does not exist").
- **jj**: point at `arbe-jj-jujutsu` and make it binding. Delegation-specific: commit only your own files, don't reshape history, report it instead if history looks like it needs repair.
- **Repo-wide checks go red under a worker's feet on a busy copy** — another worker's *uncommitted* mid-flight edits fail `bun run check`/`test` in files the first never touched, and it settles as blocked with finished work uncommitted. When two workers share the copy, put it in both briefs: red in files outside your fileset is expected — confirm none of the errors are in files YOU touched, verify with scoped checks, commit your own files, and note that repo-green re-verification happens after the tree settles.
- **A blocker sends workers routing around it** — dead key, dead dev server, missing auth. Ask for one line of `blocked` and a stop. Same for your own fences: a scope rule that blocks the right fix should be reported, not detoured around.
- **pi subagents route independently of their parent** and die on OpenRouter 402s or expired Anthropic OAuth, surfacing as a fake blocker. For code reading or editing, tell the worker to use its own model and not fan out.

**Some files every worker must touch — own those yourself.** A repo convention like "a changelog bullet in the same change" turns one file into N writers and a guaranteed conflict; a tracker with a known concurrent-write bug loses updates the same way. Don't split them, take them: the brief says "do not add a changelog entry, do not run task update/close — I do both as your work lands." Costs the orchestrator a minute per landing and removes a whole class of collision.

**A worker has no channel but its own pane**, and one that doesn't know this goes hunting for a thread or CLI to ask its question. Worth stating verbatim:

> To ask the orchestrator anything or report a blocker: stop, print one final line starting with `ORCHESTRATOR: <question or blocker>`, and end your turn. Your settled pane IS the message — it is read promptly. Do not look for another channel; do not work around the question.

**Every worker owes a closing report — say so, because silence is indistinguishable from success.** A worker that ends its turn with a tool call and no text looks exactly like one that finished, and a worker that never started looks like both. State the contract in the brief:

> Your last turn must be a written report of what you did. Not a tool call, not silence. If you did nothing, say you did nothing and why. An empty final turn means the work is not done, and I will treat it as a failure rather than a result.


## 3. Watch and steer

`herdr agent list` when you regain control. A settled pane is a *claim* of a finished report — not the report. Verify it before you act on it (see **A settle is not a result** below).

Watching one worker: don't poll — `agent prompt --wait` (or `agent wait`) blocks until the first settled idle/done/blocked state, per `herdr --skill`. Watching several at once: no native multi-agent wait exists (`agent wait` is single-target, `notification` is display-only), so poll `agent list`. The current best-known loop shape — improve it and update this if you find better:

- watch an explicit name list, not everyone: other orchestrators (including the human) run panes in the same session, and their settles are not your business
- print `.name`, not `.agent` — `.agent` is the kind (`cursor`, `pi`), which tells you nothing when you run two of them
- report `blocked` immediately (approval dialogs want fast unblocking), but only report idle/done after it persists two polls — cursor flaps working/idle mid-turn and single-poll settles are mostly false
- don't gate loop exit on a count of working agents; exit when every *watched* name has settled

```sh
WATCH="worker-a worker-b"; prev=""
while true; do
  cur=$(herdr agent list | jq -r --arg w "$WATCH" '.result.agents[] | select(.name as $n | ($w | split(" ") | index($n))) | "\(.name): \(.agent_status)"' | sort)
  # emit blocked lines at once; diff idle/done against prev to debounce one poll
  sleep 15
done
```

**A settle is not a result — check the pane produced something before you believe it.** This is the failure that costs most, because it is silent: the worker settles, the loop reports success, and the orchestrator moves on. Read the pane and classify before acting. Three empty shapes look identical in `agent list`, and each needs a different response:

| what you see | what happened | what to do |
|---|---|---|
| statusline `0.0%/272k` | the prompt never landed | re-send it; nothing ran |
| context burned, no assistant text, no diff/commit | ran and produced nothing | retry or escalate — never accept |
| context burned, no text, but a real diff | did the work, skipped the report | ask for the report; do not redo the work |
| assistant text present | a real report | review it |

The predicate is *visible assistant text* — the same one arbe uses on its own bot turns (`assistantText`), where thinking-only counts as empty. Do not use tokens or elapsed time: a run can bill tokens and produce nothing.

Corroborate against the repo, not just the pane. `jj st` and `jj log` are the second opinion — a worker claiming a commit that is not there, or reporting nothing while the tree changed, is the same defect seen from the other side. A settle with no text AND no tree change is a failure whatever the worker's status says.

**A worker that never started looks exactly like one that finished.** Both are `idle` with no spinner in the pane, so a settle check built only on those two signals reports ALL SETTLED seconds after dispatch — with nothing done. Observed: two freshly-started pi agents were prompted, `agent prompt` returned success for both, and neither ever received the text. Add a liveness signal before you trust any settle: the pane statusline's context percentage. `0.0%/272k` means the prompt never landed, whatever `agent_status` says. Grep it out of `pane read --source visible` right after prompting and confirm it moved off zero before you start watching.

**`agent start` returning `interactive_ready: true` does not mean pi can accept a prompt.** It is still loading its provider and model docs, and a prompt sent into that window is swallowed with no error. Sleep ~15s after start, read the pane, and only then prompt — then verify as above.

**`agent_status` alone cannot tell you a pi worker settled.** Two separate false settles, both observed in one session: `agent prompt --wait` returned `done` *immediately* after submission, before the agent had started — it matched a state sampled at submit time, not a real settle. And a two-poll/10s debounce on `agent list` also reported settled while the pane still showed `⠦ Working...`; pi flaps idle in the gaps between tool calls, and 10–15s intervals sit inside that window. The skill's cursor warning applies to pi too.

What actually holds: treat `agent_status` as a hint and confirm it against the pane's own text. A settle needs status in {idle, done} **and** `herdr pane read <pane> --source visible` showing no spinner — grep for `Working\.\.\.|esc to interrupt|⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` — twice in a row, 20s apart. Wrap it in a `settled()` shell function and the multi-agent loop above becomes reliable.

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
- **The worker tests the reproduction; you test the fix's *mechanism*.** A worker closed a bug where a flag-looking title swallowed the rest of the command, and proved it by replaying the original command. The fix shielded such tokens behind generated placeholders — and restored them only in the positionals array, so the same token passed as an *option value* handed the caller a literal `arbe-shielded-positional-0`. Green tests, correct repro, new bug. Ask "what else flows through the thing they changed?" and probe that path specifically. A ten-line script importing the changed function directly beats reading the diff twice — use an absolute import path, a relative one from a scratchpad won't resolve.
- **Reproduce a reported blocker outside the worker's change before you believe it.** A worker concluded a whole feature was broken because its proof hit `500 server.internal ... failed (404): not found`. Running a plain unrelated command against the same service failed identically — so it wasn't the work — and `fly status` showed the service's machine had cold-started a minute after the failure. Retried, it worked. The worker could not have known: it only ever exercised its own code path. Then make it compound — file the task for the bad diagnostic, not just the unblock.
- **A blocked worker is usually 30 seconds of your time, not theirs.** Of six workers, two stopped on blockers — correct behaviour, and worth a line in every brief. Neither could resolve its own: one asked to widen its fileset, and the answer was in `jj st` (the contended file had just been committed by another agent); the other's blocker was infrastructure. Check the *current* tree state when unblocking, not the state you briefed against.
- **Your context is for taste, not code-reading.** Reading modules to prep a brief, tracing a flow, line-verifying a diff — all delegable. Keep the conclusion, not the files.
- **A concurrent commit can absorb your worker's edits or change a contract under them.** jj commits snapshot the working-copy state of the named files, so another pane committing a file your worker edited takes those edits with it — the worker then reports "no remaining diff" on its own commit, which is not failure. And a mid-flight commit can change an API your worker's diff keys on (a helper gaining a parameter broke a just-written correlation). After any fix round on a busy working copy: `jj log` for commits that landed during it, verify with `jj show --stat` where your edits actually live, and point the re-review at interactions with those commits explicitly.
- **A cheap scout's conclusions can be right while its file:line citations are invented.** Spot-check the two or three load-bearing paths yourself before pasting them into an implementation brief — a brief anchored on hallucinated paths sends the implementer hunting.
- **"I found nothing" is the easiest wrong answer to give, and it arrives with full confidence.** A scout asked whether a task had any work in the tree reported "zero commits, no work started" — the work had shipped to production that afternoon. It had grepped commit subjects for the task's own words and capped at 40 commits on a day with 50+. Absence is only evidence if the search was right, so make a negative brief say *how* to look: give the time window and the commit count to cover, name the files and directories the work would have touched, and require the report to state the method it used, not just the verdict. Then sanity-check any "nothing found" against the thing you already believe — the human's "we made it faster this morning" beat the scout's whole report.

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
- **Give one orchestration its own tab.** Workers scattered across the human's tabs are unfindable, by you and by them. `pane move <pane> --new-tab --label "<name>"` for the first worker, `pane move <pane2> --tab <tab-id> --split down` for the rest, then `tab rename <tab-id> "<n> <name>"` to match whatever numbering the session already uses.
- **Close panes you no longer need** — once the worker's work is committed and reviewed, `pane close <pane-id>` (only panes you created; leave the human's and other orchestrators'). Lingering settled panes crowd the tab past the ~5-pane readability limit and read as live workers to the next orchestrator.

## Gotchas

- **`herdr pane create` does not exist.** It is `pane split <pane> --direction right|down`.
- **`agent prompt` takes TEXT as a positional, before any flags**: `agent prompt <name> "<text>" --wait`. Flags first fails with `unknown option: <your whole prompt>`, which reads like a quoting bug and isn't.
- **herdr result envelopes are not uniform.** `pane split` returns `.result.pane`; `pane move` does not, so parsing for it throws on a move that in fact succeeded. Verify with `pane list` rather than trusting a field name across commands.
- **Always target `pane split` with `--current`** (or an explicit `$HERDR_PANE_ID`). With no target herdr splits the UI-focused pane, which may belong to the human or another client.
- **Address agents ONLY by registered name, never a pane id.** Retrying a failed `agent prompt` with a pane id once delivered the text to the orchestrator's OWN session *and* other workers' panes. If the target isn't in `agent list`, you can't reach it — relay through the human.
- **`--provider openai` and `--provider openai-codex` are different bills.** `openai-codex` is the OAuth/subscription path; plain `openai` goes per-token against an API key. The pane tells you which you got: the statusline reads `(openai-codex)` and carries a `$x.xxx (sub)` marker, versus `(openai)` with no `(sub)`. Check it after every `agent start` — the flag is one word away from silently spending real money, and `agent start` reports success either way.
- **Always pass a distinct `<name>` to `agent start`.** Several panes named `claude` make every agent-addressed command ambiguous, and the pane-addressed fallback is unreliable — `pane send-keys <pane> enter` returns `ok` and sometimes doesn't submit. Reused names also collapse in the sidebar, so neither you nor the human can tell which worker is which. Check `agent list` before reusing a name you've used this session.
- **`--wait` timeout ≠ stuck.** Exits 1 with `{"error":{"code":"timeout"}}` but the worker is usually still working. Do not re-prompt — poll `agent get` until `agent_status` leaves `working`.
- **`agent_pane_busy` right after `pane split`** means the shell hasn't spawned yet. Wait ~5–10s and retry once; still refusing is a dud pane — close it and split fresh. To relocate a live worker afterwards: `herdr pane move <pane-id> --tab <tab-id> --split right --target-pane <sibling>`. `pane move` never disturbs the agent but silently no-ops on a zoomed tab (`changed:false, reason:"zoomed_tab"`) — `pane zoom <pane-id> --off` first.
- **`--source recent-unwrapped` can return empty for pi panes**; `visible` works.
- **`Codex error: The usage limit has been reached`** doesn't look like a failure — the worker settles as `done` ~15s after briefing, having done nothing. A fast `done` on a big slice is the tell. Rebuild the pane with a different `--model` and tell the human their sub quota is out. The general rule (any provider): `done` with no assistant text in the pane is not a completion — read before trusting a fast settle — see **A settle is not a result** in §3 for the full classification.
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
