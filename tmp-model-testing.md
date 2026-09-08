# Model testing — herdr-delegate `wait` benchmark (2026-09-07)

Same brief to every model: add a `herdr-delegate wait NAME...` subcommand that only settles on a real settle (pi + Claude Code idioms), prechecks names, classifies never_ran / blocked / report, `--any` / `--all`, fake-herdr tests, README line. One clone per model, all checked out at bookmark `bench-base`. Brief: scratchpad `brief-improve-delegate-wait.md` (identical except repo path and worker name).

Cost is the provider's list-price equivalent; every run was on a subscription. Tokens are input (fresh + cache reads) and output.

## Leaderboard, all rounds

Quality rank is the graders' consensus; within a round the two graders were blind and agreed on first place every time.

| rank | model | wall | cost | output tokens | graders' one-liner |
|---|---|---|---|---|---|
| 1 | gpt-6-astra medium | 6m 29s | $1.38 | 8.9k | smallest implementation, best tests, the only one both graders called correct |
| 2 | Fable 5.1 medium | 4m 17s | $2.43 | 20.9k | best foundation, concurrent + clean cancel; confirm sleep ignores the deadline |
| 3 | gpt-5.6-sol medium | ~10m | $1.78 | 17k | sound settle logic, thin tests, hot re-arm loop |
| 4 | glm-5.3-flash | ~13m | $0.03 | 28k | tasteful and tiny, but sequential waits and a weak settle contract |
| 5 | gpt-5.6-luna high | ~9m | $0.08 | 24k | 105 herdr calls in 1.5s on a flap, and tests that bake it in |
| 6 | Opus 5 high | 8m 45s | $3.05 | 37.5k | most code, worst bug: a vanished agent reported as a successful settle |
| — | qwen3.8-flash | 39m | $0.03 | 33k | no diff; drifted into reverse-engineering the herdr binary |

Rounds 1 and 2 were graded separately, so the cross-round order between astra and Fable is my reading of the two reports, not a head-to-head.

## Round 1

| | Opus 5 high (claude) | gpt-6-astra medium (pi, codex) | gpt-5.6-sol medium (pi, codex) |
|---|---|---|---|
| wall time | 8m 45s | 6m 29s | ~10m 20s |
| cost | $3.05 | $1.38 | $1.78 |
| input tokens | 2.6M | 0.48M | 1.43M |
| output tokens | 37.5k | 8.9k | 17k |
| diff | +294 / -8 | +223 / -8 | +198 / -15 |
| tests passing | 34 | 55 | 28 |
| commit | robots `rllplrrr` | robots-astra `nnyxvnks` | robots-sol `qqqtmnos` |

### Blind grading (patches labelled A=sol, B=Opus, C=astra; key withheld)

Two graders, fresh sessions, same rubric (brief fidelity, adversarial correctness, test quality, fit, size), told to run the tests.

| grader | 1st | 2nd | 3rd |
|---|---|---|---|
| Opus 5 xhigh | astra | sol | Opus |
| gpt-6-astra high | astra | sol | Opus |

Scores (fidelity / correctness / tests / fit / size):

| | Opus grader | astra grader |
|---|---|---|
| A sol | 4 / 4 / 3 / 3 / 4 | 3 / 2 / 3 / 4 / 4 |
| B Opus | 3 / 2 / 4 / 3 / 2 | 3 / 1 / 3 / 2 / 2 |
| C astra | 5 / 4 / 5 / 4 / 5 | 4 / 5 / 4 / 5 / 5 |

Worst bug per entry, both graders agreed:
- **Opus**: a name that disappears mid-wait is reported as a successful settle with empty output — the exact false-settle the command exists to kill. Also ignores the deadline during the confirm sleep; hand-rolled cancellation where AbortController existed.
- **sol**: re-arm loop has no pause (tight spin on a flapping wait); confirmation trusts stale status.
- **astra**: 100 ms re-arm pause can spawn ~30 herdr processes/s while a Claude pane repaints; precheck stops at the first missing name.

Takeaway: for a well-specified brief with a fake to test against, astra medium beat Opus high on quality and cost by a wide margin. Opus's extra 2M input tokens bought a longer report, not better code.

## Round 2

| | Fable 5.1 medium (claude) | glm-5.3-flash (pi, openrouter) | gpt-5.6-luna high (pi, codex) |
|---|---|---|---|
| wall time | 4m 17s | ~13m | ~9m |
| cost | $2.43 | $0.03 | $0.08 |
| input tokens | 0.64M | 0.88M | 1.6M |
| output tokens | 20.9k | 28k | 24k |
| diff | +259 / -18 | +182 / -5 | +220 / -15 |
| tests passing | 37 | 30 | 28 |
| commit | robots-fable `zsuxzylu` | robots-glm `lrzovyzm` | robots-luna `ozontmkk` |

### Blind grading (D=glm, E=fable, F=luna), same two graders after a context reset

| grader | 1st | 2nd | 3rd |
|---|---|---|---|
| gpt-6-astra high | fable (19/25) | luna (14/25) | glm (13/25) |
| Opus 5 xhigh | fable | glm | luna |

Scores (fidelity / correctness / tests / fit / size):

| | Opus grader | astra grader |
|---|---|---|
| D glm | 4 / 3 / 3 / 4 / 4 | 2 / 2 / 2 / 3 / 4 |
| E fable | 5 / 4 / 5 / 4 / 3 | 4 / 3 / 4 / 4 / 4 |
| F luna | 4 / 2 / 3 / 3 / 3 | 3 / 2 / 3 / 3 / 3 |

Worst bug per entry (astra grader, each reproduced with a probe):
- **glm**: settles immediately on `agent_not_running` with quiet text, no allowed status, no confirmation.
- **fable**: the final third read is returned as settled unchecked; a probe returned success with "new message ↓" visible.
- **luna**: activity check only scans the `--lines`-limited text; with `--lines 1` it settled while activity sat above the footer.

Opus grader's worst bugs, each reproduced with a probe:
- **glm**: sequential waits, so `--any` over ten workers degrades to one at a time; `--lines 1` returns empty text because a trailing newline takes the last slot.
- **fable**: the confirm sleep ignores the deadline, so every settle overruns `--timeout` by 20s. Otherwise "the only one that waits concurrently, cancels cleanly, and has tests tight enough to catch a settle regression".
- **luna**: no pause on re-arm; a busy pane produced 105 herdr calls in 1.5s, and the any-vs-all test passes because of that hot loop.

Both graders put Fable first. They split on second place: Opus liked glm's taste and small diff, astra penalised its incomplete settle contract. None of round two was judged safe to ship unchanged.

## Round 3

| | qwen/qwen3.8-flash (pi, openrouter) |
|---|---|
| wall time | 39m, then stopped by the orchestrator |
| cost | $0.03 |
| input tokens | 0.59M |
| output tokens | 33k |
| diff | none |
| tests passing | n/a |

Two attempts. The first hit two "Request timed out" errors from the provider in the opening minute, asked itself "are we online?", and spent 20 minutes curling the internet; restarted fresh in a new pane. The second read the files, then drifted into running `strings` on the herdr binary to reverse-engineer its event format, typed "you stuck?" into its own pane, and never wrote a line of the subcommand. Stopped at 39 minutes with no diff. Not graded.

Takeaway: below glm-5.3-flash the brief needs a much tighter leash, or the model isn't worth the orchestrator's attention at any price.

## Papercuts seen while benchmarking

- `jj git clone` from a local path leaves the working copy on an empty root change; `jj new bench-base` needed before the files exist. Astra stopped correctly at "files don't exist"; the restart cost a minute.
- A fresh Claude Code worker in a new directory blocks on the folder-trust prompt; herdr-delegate reports it as `agent_not_ready` at stage start. Needs a keypress before the brief lands.
