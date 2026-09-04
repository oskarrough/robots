---
name: arbe-delegate
description: Hand work to another agent running in a herdr pane — pick a worker, brief it, watch, steer, review. Use for parallelizable or throwaway work you don't want in your own context. Requires HERDR_ENV=1. To decide what to hand off and in what order first, see arbe-orchestrate.
---

# Delegate

Delegate work whose result is cheaper to review than to produce yourself. Keep a small edit you already understand, or work needing context only you hold.

Requires `test "${HERDR_ENV:-}" = 1`; workers run in visible herdr panes. Read `herdr --skill` for CLI mechanics; it wins when this file disagrees. For command errors or misbehaving workers, read [troubleshooting](references/troubleshooting.md).

Default: start, brief, watch, review, return the result. For an explicit launch-and-handoff request, report the agent name and pane ID and leave it running.

## Fast path: `herdr-delegate`

When installed, use the wrapper for one fresh worker:

```sh
herdr-delegate <name> '<prompt>' --kind pi --timeout 60000 -- --provider openrouter --model <model> --thinking high
```

It splits, starts, verifies runtime, prompts, waits, and reads; NAME and PROMPT are required. The JSON envelope carries handles, runtime, and `terminal_text`. `ok` does not prove useful work happened — apply §3. On failure inspect `stage`, `upstream_herdr_error`, and `cleanup`. Never move a pane during its live wait; that can break the wait while the worker continues.

Use manual commands for a crew, placement, or steering. Warm workers take `herdr agent prompt <name> '<prompt>'`; reset unrelated context first (§5).

## 1. Pick and place workers

Use cheap implementers with strong direction and independent review. Escalate or split a repeatedly failing brief. Current preferences are volatile: ask Oskar before assuming free capacity or reintroducing benched models (terra, haiku, deepseek).

| work | preference |
| --- | --- |
| scouting, smoke tests, ordinary implementation | `z-ai/glm-5.3-flash`, pi with `--provider openrouter`; keep briefs tight. Alternatives: `gpt-5.6-luna` on the Codex sub, `cursor-grok-4.6-high` through cursor. |
| hard planning and implementation; review of migrations, dispatch, retry/error contracts | `gpt-5.6-sol`, pi with `--provider openai-codex`; `--thinking medium` for ordinary implementation, `high` for hard work. Sol review is required for these sensitive contracts. |
| UI design, hard thinking, adversarial review | Opus 5 through claude: `--model opus --effort high`; `xhigh` for hard implementation or adversarial review. |

Prefer explicit pi `--provider`, `--model`, and `--thinking` arguments; verify resolved values before briefing. Codex subscription routing is `openai-codex`, with `(openai-codex)` and `$x.xxx (sub)` in the statusline; `openai` bills per token. Use claude for Anthropic capacity. Cursor effort lives in its model ID; avoid costly `-fast` variants. Default worker thinking ceiling is `high`; cheap models can loop at higher levels.

```sh
herdr agent start <name> --kind pi --pane <pane-id> -- --provider openai-codex --model <model> --thinking high
herdr agent start <name> --kind claude --pane <pane-id> -- --model opus --effort high
herdr agent start <name> --kind cursor --pane <pane-id> -- --model <model>
```

- Check `agent list` first. Give every agent a unique job name, at most three plain words (`review-secrets`); address agents by registered name, never pane ID. An unregistered target is unreachable — don't guess a fallback. Name non-agent panes with `pane rename`.
- Split with `pane split --current` or an explicit pane ID; an omitted target follows UI focus. Split and start in the current tab, then move into a labelled worker tab. Panes created inside a `tab create --no-focus` tab can fail to start.
- Keep workers out of the human's tab. Pass `--workspace <id>` to `tab create`, then `pane move <pane> --tab <tab> --split right --target-pane <sibling>`. Limit each tab to four workers so panes remain readable.
- For ongoing batches, reuse a crew of roughly four warm workers. Feed small tasks, fence ownership on every dispatch, and reset unrelated context. Start fresh for a different runtime, required isolation, or unrecoverable drift.
- Parallelize disjoint files. Give cascading deletion sweeps one owner; shared dependencies can make separate directories conflict.

## 2. Brief

Each ask should review and ship in one sitting. Split unrelated outcomes or separately deployed surfaces. Keep what/why/done-when/evidence in the tracked task when one exists; the brief adds this run's files, constraints, checks, and report shape. Write the brief yourself; scout findings inform your decisions.

Use a prompt for a short ask, a file for a long brief, and one shared rules file for a crew. Resolve referenced SKILL.md paths on disk or inline the rules — workers may not have your harness's skills.

Include what applies:

- **Ownership:** name allowed and off-limits files, including shared dependencies. Workers are not alone; preserve others' edits. A necessary change outside scope is a question, not permission to cross it. Split a collision into independent work and the part needing coordination.
- **Scope:** for a sweep, give measured scope, a cap, exclusions, and keep-criteria. Name exact enums and who owns external actions such as deployment.
- **Evidence:** require a probe of the actual workflow in an appropriate test environment where practical, with enough detail to reproduce it. Use focused tests where needed. For another service's data shape, cite the producing code instead of inventing test input.
- **Checks:** use the project's scoped test command from the right package directory and a scoped check before committing. Avoid repeated whole-repo runs; verify repo-wide once the shared tree settles. Do not change shared dependencies or lockfiles to repair an unrelated check failure; report it and rerun once the tree settles.
- **Commits:** resolve and supply `arbe-jj-jujutsu`, binding. Commit only owned files, one implementation outcome per commit. Report history repairs; never rewrite history while workers are active. Own shared bookkeeping yourself and consolidate it after the batch settles.
- **Blockers:** report missing auth, stopped shared services, or scope conflicts; don't start services or work around boundaries just to finish a probe. Tell pi workers to use their own model rather than fan out through independently billed subagents.
- **Report:** plain language, at most ten lines in the pane: outcome, files/commits, checks and results, remaining blockers. Long measurements go in a file; don't ask workers to commit their report.

State both contracts:

> To ask the orchestrator anything or report a blocker: stop, print one final line starting with `ORCHESTRATOR: <question or blocker>`, and end your turn. Your settled pane is the message. Do not look for another channel or work around the question.

> End with a written report, not a tool call or silence. If you did nothing, say why. An empty final turn is not a result.

## 3. Watch and steer

For a crew, prompt without waiting, then run a detached wait per explicit agent name. Aborting a wait does not cancel the worker.

```sh
herdr agent prompt <name> '<brief>'   # positional text before flags
herdr agent wait <name> --until done --until blocked   # run detached
```

Handle `blocked` promptly. Verify the prompt landed: a fresh pane still at `0.0%` context may never have started. Read the pane before resending once; never blindly repeat a timed-out prompt. Don't add fixed startup sleeps — herdr waits for readiness.

A settled status is a claim. Check `pane read <pane> --source visible` for activity as well: require idle/done status and no spinner or `Working...` / `esc to interrupt`, twice 20 seconds apart. Lifecycle signals can reflect the previous turn or flap between tools.

Then inspect visible assistant text and the repository:

| result | action |
| --- | --- |
| no assistant report, no diff | confirm it ran; retry or escalate |
| no report, real diff | ask for the report; preserve the work |
| report present | review it and corroborate commits with `jj st` / `jj log` |

Thinking text, token usage, and elapsed time do not prove completion. A suggested message in a Claude composer's input is not a human answer; clear it with `send-keys <name> esc`. The human may also steer workers directly, so reported mid-session approval can be real.

Use `STEERING:` for a scope correction. For drift, interrupt and request a short checkpoint: goal, design, files touched, unnecessary additions; then explicitly resume. Before committing, ask: “Reread your diff and cut anything not needed for the goal.”

## 4. Review

A strong reviewer, independent of the author, reviews every non-trivial diff for correctness, design, and compactness. Weigh findings against actual behavior before relaying fixes; answer rejected findings in the re-review prompt.

- Require check output from the final edits. Probe what else uses the changed mechanism; tests written with the fix may encode the same mistaken assumption. Verify against the original failure and attack scenarios.
- Use language tooling for claims like unused code. Spot-check important scout citations. A negative finding must state its search method, scope, and time window.
- Reproduce blocker claims outside the worker's change and check the current tree before acting; another worker may already have resolved the conflict. Track misleading diagnostics when they warrant follow-up.
- Concurrent commits can absorb a worker's edits or change its dependencies. Use `jj log` and commit stats to locate the work, then include those interactions in re-review. Rewording with `jj describe` changes the commit ID; hold it until review finishes or give the reviewer the new ID.

Delegate evidence gathering when useful; keep the judgment and conclusions in your context.

## 5. Reset and close

Keep context for the same task and direct follow-ups. Reset for unrelated work, rejected designs, or drift:

```sh
herdr agent prompt <name> "/new" --wait --timeout 15000
```

Near the context ceiling, reset and rebrief; repeated review rounds accumulate context too. `/new` resets pi thinking to the start args and can report `agent_prompt_stalled` despite succeeding — confirm with `agent read`. Use a genuinely fresh agent when isolation is part of the proof.

For a drifting worker, ask it to stop investigating and report verified findings; pursue follow-ups in fresh context. Once the batch is committed and reviewed, close the panes you created with `pane close <pane-id>`. Leave the human's and other orchestrators' panes alone.

---

Keep this skill short: merge new lessons into existing rules, omit incident stories, and put recovery details in troubleshooting. CLI mechanics belong in `herdr --skill`; volatile model preferences belong in §1.
